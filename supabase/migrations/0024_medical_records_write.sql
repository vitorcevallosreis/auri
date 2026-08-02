-- Criação e edição de prontuário pelo profissional.
--
-- 0022 abriu revisar/assinar por RPC e deixou registrado o motivo de NÃO criar
-- policy de UPDATE para o papel `professional`: policy autoriza linha, nunca
-- coluna, e uma que permitisse escrever o texto clínico permitiria também
-- carimbar `signed_at` na mão. A regra continua valendo — então escrever
-- conteúdo também entra por função, e a superfície de escrita do médico nesta
-- tabela permanece: criar, salvar, revisar, assinar. Nada mais.

-- --------------------------------------------------------------------------
-- Criar
--
-- O prontuário nasce de um ATENDIMENTO — não existe prontuário solto. A escolha
-- do modelo acontece aqui, e não depois, porque é ela que decide quais campos o
-- médico vai ver na tela seguinte.
-- --------------------------------------------------------------------------
create or replace function create_medical_record(
  p_appointment_id uuid,
  p_template_id    uuid
)
returns myia_medical_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prof uuid := auth_professional_id();
  v_comp uuid := auth_company_id();
  v_appt record;
  v_row  myia_medical_records;
begin
  if app_role() is distinct from 'professional' or v_prof is null then
    raise exception 'Somente o profissional responsável cria o prontuário'
      using errcode = '42501';
  end if;

  -- A função é `security definer`: o RLS não vale aqui dentro, e este predicado
  -- é a única coisa impedindo alguém de abrir prontuário no atendimento de
  -- outro médico. Por isso ele checa profissional E empresa, em vez de confiar
  -- na FK composta que só verifica a coerência do par.
  select a.id, a.appointment_date, a.client_id, a.status
    into v_appt
    from myia_appointments a
   where a.id = p_appointment_id
     and a.professional_id = v_prof
     and a.company_id = v_comp;

  if not found then
    raise exception 'Atendimento não encontrado' using errcode = 'P0002';
  end if;

  if v_appt.status = 'cancelled' then
    raise exception 'Atendimento cancelado não gera prontuário' using errcode = '23514';
  end if;

  -- Modelo precisa ser VISÍVEL para esta clínica: do catálogo do sistema ou
  -- dela própria, e não arquivado. Sem esta checagem, um id de modelo de outra
  -- clínica passaria — a FK só exige que o modelo exista.
  if p_template_id is not null and not exists (
    select 1 from myia_record_templates t
     where t.id = p_template_id
       and t.archived_at is null
       and (t.company_id is null or t.company_id = v_comp)
  ) then
    raise exception 'Modelo indisponível' using errcode = 'P0002';
  end if;

  -- `unique (appointment_id)` de 0020 já garantiria um por atendimento, mas o
  -- erro cru de violação de unicidade não diz à tela o que fazer. Aqui ele vira
  -- um código que o cliente traduz em "já existe — abrir o existente".
  if exists (select 1 from myia_medical_records where appointment_id = p_appointment_id) then
    raise exception 'Este atendimento já tem prontuário' using errcode = '23505';
  end if;

  insert into myia_medical_records (
    company_id, appointment_id, professional_id, contact_id,
    record_date, template_id, content, source, review_status
  ) values (
    v_comp, p_appointment_id, v_prof, v_appt.client_id,
    v_appt.appointment_date, p_template_id, '{}'::jsonb, 'manual', 'pending'
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- --------------------------------------------------------------------------
-- Salvar conteúdo
-- --------------------------------------------------------------------------
create or replace function save_medical_record(
  p_record_id   uuid,
  p_content     jsonb,
  p_template_id uuid default null
)
returns myia_medical_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prof   uuid := auth_professional_id();
  v_comp   uuid := auth_company_id();
  v_atual  myia_medical_records;
  v_merge  jsonb;
  v_row    myia_medical_records;
begin
  if app_role() is distinct from 'professional' or v_prof is null then
    raise exception 'Somente o profissional responsável edita o prontuário'
      using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_content, 'null'::jsonb)) <> 'object' then
    raise exception 'Conteúdo inválido' using errcode = '22023';
  end if;

  select * into v_atual
    from myia_medical_records
   where id = p_record_id
     and professional_id = v_prof
     and company_id = v_comp
   for update;

  if not found then
    raise exception 'Prontuário não encontrado' using errcode = 'P0002';
  end if;

  -- Assinado não se edita. É o mesmo estado terminal de 0022, visto do outro
  -- lado: lá ele impede reassinar, aqui impede alterar o que foi assinado —
  -- que é o que daria à assinatura o valor de nada.
  if v_atual.review_status = 'signed' then
    raise exception 'Prontuário assinado não pode ser alterado' using errcode = '23514';
  end if;

  if p_template_id is not null and not exists (
    select 1 from myia_record_templates t
     where t.id = p_template_id
       and t.archived_at is null
       and (t.company_id is null or t.company_id = v_comp)
  ) then
    raise exception 'Modelo indisponível' using errcode = 'P0002';
  end if;

  -- MESCLA, não substitui. O formulário só conhece os campos do modelo ATUAL;
  -- um prontuário que trocou de modelo, ou que veio da IA com campos a mais,
  -- guarda conteúdo fora dessa lista. Substituir apagaria esse texto — que é
  -- registro clínico, e é exatamente o que a tela de leitura mostra como
  -- "sobras" em vez de descartar.
  v_merge := coalesce(v_atual.content, '{}'::jsonb) || p_content;

  -- As cinco colunas legadas são reescritas a partir do resultado.
  --
  -- Não é dupla fonte de verdade: `content` continua sendo a origem, e este é o
  -- único ponto onde a cópia acontece. É o que impede o gatilho de 0023 —
  -- que faz `legado || content` — de ressuscitar um texto que o médico acabou
  -- de apagar, porque aí os dois lados dizem a mesma coisa.
  update myia_medical_records
     set content         = v_merge,
         chief_complaint = v_merge->>'chief_complaint',
         anamnesis       = v_merge->>'anamnesis',
         physical_exam   = v_merge->>'physical_exam',
         assessment      = v_merge->>'assessment',
         plan            = v_merge->>'plan',
         template_id     = coalesce(p_template_id, template_id),
         -- Editar um rascunho já revisado o devolve para "aguardando revisão":
         -- o "revisado" se referia ao texto anterior.
         review_status   = case when v_atual.review_status = 'reviewed' then 'pending'
                                else v_atual.review_status end,
         reviewed_at     = case when v_atual.review_status = 'reviewed' then null
                                else reviewed_at end,
         updated_at      = now()
   where id = p_record_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function create_medical_record(uuid, uuid) to authenticated, service_role;
grant execute on function save_medical_record(uuid, jsonb, uuid) to authenticated, service_role;

comment on function create_medical_record(uuid, uuid) is
  'Abre o prontuário de um atendimento do próprio profissional, já com o modelo escolhido.';
comment on function save_medical_record(uuid, jsonb, uuid) is
  'Grava o conteúdo do prontuário não assinado. Mescla com o que já existe: '
  'campos fora do modelo atual são preservados.';
