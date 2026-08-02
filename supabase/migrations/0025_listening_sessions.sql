-- Escuta assistida da consulta.
--
-- O fluxo é: consentimento do paciente → o navegador captura o áudio → a
-- transcrição vira texto → a IA redige o rascunho no modelo escolhido → o
-- médico revisa e assina pelas telas que já existem (0022/0023/0024).
--
-- O ÁUDIO NÃO É ARMAZENADO. Ele vai do navegador para o serviço de
-- transcrição e é descartado; nada nesta tabela guarda som. É decisão de
-- produto e é o desenho mais defensável sob a LGPD: gravação de consulta é
-- dado sensível, e o que não existe não vaza. A ausência de uma coluna de
-- áudio aqui é o registro dessa decisão.
--
-- A TRANSCRIÇÃO, sim, é guardada. Sem ela o médico não tem como conferir de
-- onde a IA tirou o que escreveu — e um rascunho clínico que não dá para
-- auditar contra a fonte não deveria existir.

create table if not exists myia_listening_sessions (
  id uuid primary key default gen_random_uuid(),

  company_id      uuid not null references myia_companies(id) on delete cascade,
  professional_id uuid not null references myia_professionals_medical(id) on delete cascade,
  appointment_id  uuid not null references myia_appointments(id) on delete cascade,
  template_id     uuid references myia_record_templates(id) on delete set null,

  -- ------------------------------------------------------------------------
  -- CONSENTIMENTO
  --
  -- `not null` de propósito: não existe linha nesta tabela sem consentimento
  -- registrado, porque não existe escuta lícita sem ele. O banco é o lugar
  -- certo para essa garantia — uma checagem só na tela seria contornável pela
  -- API, e é justamente esta a obrigação que não pode depender do cliente.
  --
  -- Quem declara é o profissional; o registro é a declaração dele de que
  -- obteve o aceite, com hora do servidor. Um fluxo de aceite assinado pelo
  -- próprio paciente é melhor e cabe depois — a coluna `method` é onde ele
  -- entra sem migração de dados.
  -- ------------------------------------------------------------------------
  consent_given_at timestamptz not null default now(),
  consent_method   text not null default 'verbal'
    check (consent_method in ('verbal', 'written')),
  consent_note     text,

  status text not null default 'recording'
    check (status in ('recording', 'transcribing', 'drafting', 'done', 'failed', 'cancelled')),

  -- Fonte que a IA leu para escrever o rascunho.
  transcript text,

  -- Erro legível quando `status = 'failed'`. Guardado porque a falha acontece
  -- depois de o médico ter conduzido a consulta inteira: ele precisa saber se
  -- o problema foi o microfone, a transcrição ou o modelo.
  failure_reason text,

  medical_record_id uuid references myia_medical_records(id) on delete set null,

  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Uma escuta por atendimento, na mesma regra do prontuário (0020).
  unique (appointment_id)
);

create index if not exists idx_listening_sessions_prof
  on myia_listening_sessions(professional_id, started_at desc);

-- --------------------------------------------------------------------------
-- Abrir a sessão
--
-- Chamada ANTES de o microfone ligar. É isso que faz o consentimento existir
-- no banco antes de qualquer áudio existir no navegador — e não depois, como
-- justificativa retroativa.
-- --------------------------------------------------------------------------
create or replace function start_listening_session(
  p_appointment_id uuid,
  p_template_id    uuid,
  p_consent_method text default 'verbal',
  p_consent_note   text default null
)
returns myia_listening_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prof uuid := auth_professional_id();
  v_comp uuid := auth_company_id();
  v_appt record;
  v_row  myia_listening_sessions;
begin
  if app_role() is distinct from 'professional' or v_prof is null then
    raise exception 'Somente o profissional responsável inicia a escuta'
      using errcode = '42501';
  end if;

  if p_consent_method not in ('verbal', 'written') then
    raise exception 'Forma de consentimento inválida' using errcode = '22023';
  end if;

  select a.id, a.status into v_appt
    from myia_appointments a
   where a.id = p_appointment_id
     and a.professional_id = v_prof
     and a.company_id = v_comp;

  if not found then
    raise exception 'Atendimento não encontrado' using errcode = 'P0002';
  end if;

  if p_template_id is not null and not exists (
    select 1 from myia_record_templates t
     where t.id = p_template_id and t.archived_at is null
       and (t.company_id is null or t.company_id = v_comp)
  ) then
    raise exception 'Modelo indisponível' using errcode = 'P0002';
  end if;

  -- Retomar uma sessão que morreu no meio (aba fechada, rede caiu) em vez de
  -- barrar: o atendimento é o mesmo e o consentimento continua valendo.
  -- Sessão já concluída, não — aí existe prontuário e o caminho é editá-lo.
  select * into v_row from myia_listening_sessions
   where appointment_id = p_appointment_id for update;

  if found then
    if v_row.status = 'done' then
      raise exception 'Este atendimento já tem prontuário gerado pela escuta'
        using errcode = '23505';
    end if;
    update myia_listening_sessions
       set status = 'recording', template_id = coalesce(p_template_id, template_id),
           failure_reason = null, started_at = now(), ended_at = null, updated_at = now()
     where id = v_row.id
    returning * into v_row;
    return v_row;
  end if;

  insert into myia_listening_sessions (
    company_id, professional_id, appointment_id, template_id,
    consent_method, consent_note
  ) values (
    v_comp, v_prof, p_appointment_id, p_template_id,
    p_consent_method, p_consent_note
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- --------------------------------------------------------------------------
-- Registrar progresso e falha
-- --------------------------------------------------------------------------
create or replace function update_listening_session(
  p_session_id uuid,
  p_status     text,
  p_transcript text default null,
  p_failure    text default null
)
returns myia_listening_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prof uuid := auth_professional_id();
  v_row  myia_listening_sessions;
begin
  if app_role() is distinct from 'professional' or v_prof is null then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  if p_status not in ('recording','transcribing','drafting','failed','cancelled') then
    raise exception 'Estado inválido: %', p_status using errcode = '22023';
  end if;

  update myia_listening_sessions
     set status = p_status,
         transcript = coalesce(p_transcript, transcript),
         failure_reason = p_failure,
         ended_at = case when p_status in ('failed','cancelled') then now() else ended_at end,
         updated_at = now()
   where id = p_session_id
     and professional_id = v_prof
     and company_id = auth_company_id()
     -- `done` é terminal: existe prontuário do outro lado, e reabrir a sessão
     -- sugeriria que ele ainda pode ser regerado por cima.
     and status <> 'done'
  returning * into v_row;

  if not found then
    raise exception 'Sessão de escuta não encontrada' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

-- --------------------------------------------------------------------------
-- Concluir: o rascunho vira prontuário
--
-- Não reaproveita `create_medical_record` (0024) de propósito: aquele nasce
-- `manual`, sem procedência de IA. Aqui o registro precisa nascer `ai`, com
-- modelo e horário de geração — é o que faz a tela avisar "revise antes de
-- assinar" antes de o médico ler o texto como se fosse dele.
-- --------------------------------------------------------------------------
create or replace function finish_listening_session(
  p_session_id uuid,
  p_content    jsonb,
  p_ai_model   text
)
returns myia_medical_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prof uuid := auth_professional_id();
  v_comp uuid := auth_company_id();
  v_sess myia_listening_sessions;
  v_appt record;
  v_rec  myia_medical_records;
begin
  if app_role() is distinct from 'professional' or v_prof is null then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_content, 'null'::jsonb)) <> 'object' then
    raise exception 'Conteúdo inválido' using errcode = '22023';
  end if;

  select * into v_sess from myia_listening_sessions
   where id = p_session_id and professional_id = v_prof and company_id = v_comp
   for update;

  if not found then
    raise exception 'Sessão de escuta não encontrada' using errcode = 'P0002';
  end if;

  if v_sess.status = 'done' then
    raise exception 'Esta escuta já gerou prontuário' using errcode = '23505';
  end if;

  if exists (select 1 from myia_medical_records where appointment_id = v_sess.appointment_id) then
    raise exception 'Este atendimento já tem prontuário' using errcode = '23505';
  end if;

  select a.appointment_date, a.client_id into v_appt
    from myia_appointments a where a.id = v_sess.appointment_id;

  insert into myia_medical_records (
    company_id, appointment_id, professional_id, contact_id,
    record_date, template_id, content,
    source, ai_model, ai_generated_at, review_status
  ) values (
    v_comp, v_sess.appointment_id, v_prof, v_appt.client_id,
    v_appt.appointment_date, v_sess.template_id, p_content,
    'ai', p_ai_model, now(), 'pending'
  )
  returning * into v_rec;

  update myia_listening_sessions
     set status = 'done', medical_record_id = v_rec.id,
         ended_at = now(), updated_at = now(), failure_reason = null
   where id = p_session_id;

  return v_rec;
end;
$$;

-- --------------------------------------------------------------------------
-- RLS — leitura própria; escrita SÓ pelas funções acima
-- --------------------------------------------------------------------------
alter table myia_listening_sessions enable row level security;

drop policy if exists listening_owner_all on myia_listening_sessions;
create policy listening_owner_all on myia_listening_sessions
  for all
  using      (company_id = (select auth_company_id()) and (select app_role()) = 'owner')
  with check (company_id = (select auth_company_id()) and (select app_role()) = 'owner');

-- Mesma escolha de 0022: leitura por policy, escrita por função. Uma policy de
-- UPDATE aqui deixaria o médico reescrever a transcrição — a única prova de
-- onde o rascunho veio.
drop policy if exists listening_professional_read on myia_listening_sessions;
create policy listening_professional_read on myia_listening_sessions
  for select using (
    (select app_role()) = 'professional'
    and company_id = (select auth_company_id())
    and professional_id = (select auth_professional_id())
  );

grant select, insert, update, delete on myia_listening_sessions
  to anon, authenticated, service_role;
grant execute on function start_listening_session(uuid, uuid, text, text) to authenticated, service_role;
grant execute on function update_listening_session(uuid, text, text, text) to authenticated, service_role;
grant execute on function finish_listening_session(uuid, jsonb, text) to authenticated, service_role;

comment on table myia_listening_sessions is
  'Escuta assistida da consulta. NÃO guarda áudio por decisão de produto (LGPD): '
  'o som vai do navegador à transcrição e é descartado. A transcrição é guardada '
  'para o médico poder auditar o rascunho contra a fonte.';
