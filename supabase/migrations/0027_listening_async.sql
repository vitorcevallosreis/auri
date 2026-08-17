-- ===========================================================================
-- 0027 — Escuta assíncrona: a transcrição sai da requisição HTTP
--
-- POR QUE.
--
-- Até aqui `POST /api/prontuario/escuta` transcrevia e redigia DENTRO da
-- requisição. Medido no VPS de produção (4 vCPU, sem GPU, Whisper `medium`):
-- ~2x tempo real. Uma consulta de 15 minutos levaria ~30 minutos, contra um
-- `maxDuration` de 300s e um `proxy_read_timeout` de 300s.
--
-- Aumentar os dois não resolve: manter uma requisição HTTP aberta por meia
-- hora é frágil por natureza — queda de rede, deploy do container ou a aba
-- fechando perdem a consulta, que é justamente a coisa que não se repete.
--
-- Então a requisição passa a APENAS enfileirar, e o worker (que já existe,
-- para os turnos do agente) faz o trabalho longo.
--
-- SEM TABELA DE FILA NOVA. `myia_listening_sessions` já é uma linha por
-- trabalho, com os estados intermediários que 0025 criou (`transcribing`,
-- `drafting`) — eles existiam justamente porque este caminho estava previsto.
-- Uma tabela de jobs ao lado duplicaria a fonte da verdade e criaria a chance
-- de as duas discordarem.
--
-- ⚠️ O ÁUDIO PASSA A TOCAR O DISCO, e isso merece ser dito em voz alta.
--
-- A decisão registrada em 0025 é que o áudio NUNCA É ARMAZENADO. Assíncrono
-- exige que ele exista em algum lugar entre a requisição e o worker; não há
-- desenho que evite isso. O que foi feito para respeitar a substância da
-- decisão:
--
--   * o arquivo fica num volume do Docker no NOSSO servidor, nunca em bucket,
--     nunca em serviço de terceiro, nunca fora do país;
--   * `audio_path` guarda um CAMINHO, não o áudio — o banco continua sem
--     nenhuma coluna capaz de conter som, e o teste de 0025 que falha se
--     alguém criar uma continua valendo;
--   * o worker apaga o arquivo assim que transcreve, com sucesso ou falha;
--   * `sweep_listening_audio()` existe para o caso de o worker morrer entre
--     transcrever e apagar.
--
-- Se essa troca não for aceitável, o caminho é voltar ao síncrono e limitar a
-- consulta por tempo na própria tela. Ver docs/ESCUTA-decisoes.md.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Colunas de fila
-- ---------------------------------------------------------------------------
alter table myia_listening_sessions
  add column if not exists audio_path  text,
  add column if not exists claimed_at  timestamptz,
  add column if not exists claimed_by  text,
  add column if not exists attempts    integer not null default 0;

comment on column myia_listening_sessions.audio_path is 'Caminho do arquivo temporario no volume compartilhado. NUNCA o audio em si. Apagado pelo worker logo apos a transcricao; ver sweep_listening_audio().';

-- A constraint fica FORA de qualquer `if not exists` pelo mesmo motivo de
-- 0014: um create que não roda também não aplicaria a constraint, e a
-- migration deixaria de ser reexecutável depois de mudar os estados aceitos.
alter table myia_listening_sessions
  drop constraint if exists myia_listening_sessions_status_check;

alter table myia_listening_sessions
  add constraint myia_listening_sessions_status_check
  check (status in (
    'recording',    -- microfone ligado, áudio ainda no navegador
    'queued',       -- áudio entregue; esperando o worker  (NOVO em 0027)
    'transcribing',
    'drafting',
    'done',
    'failed',
    'cancelled'
  ));

-- Índice parcial: o worker só procura o que está na fila, e essa é a consulta
-- que roda a cada poll. Sem o predicado, o índice cresceria com o histórico
-- inteiro de sessões concluídas.
create index if not exists idx_listening_claimable
  on myia_listening_sessions (created_at)
  where status = 'queued';

create index if not exists idx_listening_em_curso
  on myia_listening_sessions (claimed_at)
  where status in ('transcribing', 'drafting');

-- ---------------------------------------------------------------------------
-- 2. Enfileirar — porta do MÉDICO
-- ---------------------------------------------------------------------------
-- Chamada pela rota, com o JWT do próprio médico. Só marca que o áudio está
-- entregue; quem trabalha é o worker.
-- ---------------------------------------------------------------------------
create or replace function enqueue_listening_session(
  p_session_id uuid,
  p_audio_path text
)
returns myia_listening_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prof uuid := auth_professional_id();
  v_comp uuid := auth_company_id();
  v_sess myia_listening_sessions;
begin
  if app_role() is distinct from 'professional' or v_prof is null then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  if coalesce(btrim(p_audio_path), '') = '' then
    raise exception 'Caminho do áudio ausente' using errcode = '22023';
  end if;

  select * into v_sess from myia_listening_sessions
   where id = p_session_id and professional_id = v_prof and company_id = v_comp
   for update;

  if not found then
    raise exception 'Sessão de escuta não encontrada' using errcode = 'P0002';
  end if;

  -- `done` é terminal. Reenfileirar produziria um segundo prontuário para o
  -- mesmo atendimento, que o índice de 0024 recusaria só lá na frente.
  if v_sess.status = 'done' then
    raise exception 'Esta escuta já gerou prontuário' using errcode = '23505';
  end if;

  update myia_listening_sessions
     set status = 'queued',
         audio_path = p_audio_path,
         failure_reason = null,
         claimed_at = null,
         claimed_by = null,
         updated_at = now()
   where id = p_session_id
   returning * into v_sess;

  return v_sess;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Portas do WORKER
-- ---------------------------------------------------------------------------
-- O worker fala com o banco como `service_role`: não tem `auth.uid()`, não é
-- profissional de ninguém, e por isso NÃO PODE usar as funções de 0025 — todas
-- exigem `app_role() = 'professional'`.
--
-- A identidade vem da PRÓPRIA SESSÃO: `professional_id` e `company_id` são
-- lidos da linha, que só existe porque um médico autenticado a criou. O worker
-- não escolhe em nome de quem age; ele continua o trabalho que alguém já
-- autorizou.
-- ---------------------------------------------------------------------------

-- Guarda comum. Isolada numa função para que a regra tenha um lugar só.
create or replace function is_service_role()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  ) = 'service_role'
     or current_user = 'service_role';
$$;

comment on function is_service_role() is 'Verdadeiro so para o worker. Usado pelas RPCs de 0027 que agem sem usuario autenticado: elas derivam o tenant da propria linha, nunca de parametro.';

-- Reivindicar lote --------------------------------------------------------
create or replace function claim_listening_sessions(
  p_worker text,
  p_limit  integer default 1
)
returns setof myia_listening_sessions
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_service_role() then
    raise exception 'Somente o worker reivindica sessões' using errcode = '42501';
  end if;

  return query
  update myia_listening_sessions s
     set status = 'transcribing',
         claimed_at = now(),
         claimed_by = p_worker,
         attempts = s.attempts + 1,
         updated_at = now()
   where s.id in (
     select id from myia_listening_sessions
      where status = 'queued'
      order by created_at
      -- `skip locked` é o que permite vários workers sem lock distribuído:
      -- cada um leva o que o outro não travou, em vez de esperar.
      for update skip locked
      limit greatest(1, least(p_limit, 20))
   )
   returning s.*;
end;
$$;

-- Atualizar estado / gravar transcrição -----------------------------------
create or replace function worker_update_listening_session(
  p_session_id     uuid,
  p_status         text,
  p_transcript     text default null,
  p_failure_reason text default null
)
returns myia_listening_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sess myia_listening_sessions;
begin
  if not is_service_role() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  -- `done` não entra aqui: prontuário nasce só por worker_finish_..., que é
  -- quem sabe montá-lo. Sem esta trava, um estado 'done' sem prontuário
  -- deixaria a sessão terminal e a consulta perdida.
  if p_status not in ('queued', 'transcribing', 'drafting', 'failed') then
    raise exception 'Estado inválido: %', p_status using errcode = '22023';
  end if;

  update myia_listening_sessions
     set status = p_status,
         transcript = coalesce(p_transcript, transcript),
         failure_reason = p_failure_reason,
         -- Libera a reivindicação ao devolver para a fila, senão o reaper
         -- veria uma sessão 'queued' com dono e não a devolveria de novo.
         claimed_at = case when p_status = 'queued' then null else claimed_at end,
         claimed_by = case when p_status = 'queued' then null else claimed_by end,
         ended_at = case when p_status = 'failed' then now() else ended_at end,
         updated_at = now()
   where id = p_session_id and status <> 'done'
   returning * into v_sess;

  if not found then
    raise exception 'Sessão de escuta não encontrada ou já concluída'
      using errcode = 'P0002';
  end if;

  return v_sess;
end;
$$;

-- Concluir: o rascunho vira prontuário ------------------------------------
-- Espelha finish_listening_session (0025) na lógica; muda só de onde vem a
-- identidade. Mantidas as duas travas que importam: escuta já concluída e
-- atendimento que já tem prontuário.
create or replace function worker_finish_listening_session(
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
  v_sess myia_listening_sessions;
  v_appt record;
  v_rec  myia_medical_records;
begin
  if not is_service_role() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_content, 'null'::jsonb)) <> 'object' then
    raise exception 'Conteúdo inválido' using errcode = '22023';
  end if;

  select * into v_sess from myia_listening_sessions
   where id = p_session_id for update;

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
    -- Da SESSÃO, não de parâmetro: o worker não escolhe o tenant.
    v_sess.company_id, v_sess.appointment_id, v_sess.professional_id,
    v_appt.client_id, v_appt.appointment_date, v_sess.template_id, p_content,
    'ai', p_ai_model, now(), 'pending'
  )
  returning * into v_rec;

  update myia_listening_sessions
     set status = 'done', medical_record_id = v_rec.id,
         ended_at = now(), updated_at = now(),
         failure_reason = null, audio_path = null
   where id = p_session_id;

  return v_rec;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Reaper e varredura de áudio órfão
-- ---------------------------------------------------------------------------
-- Worker morto no meio do trabalho deixa a sessão presa em `transcribing` ou
-- `drafting` para sempre. Devolve para a fila até um teto de tentativas —
-- sem teto, uma sessão que quebra o worker o derruba em laço.
-- ---------------------------------------------------------------------------
create or replace function reap_listening_sessions(
  p_timeout_seconds integer default 1800,
  p_max_attempts    integer default 3
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_devolvidas integer;
begin
  if not is_service_role() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  -- O teto é generoso (30 min) porque o trabalho é MESMO longo: transcrever
  -- 15 minutos de consulta leva ~30 no VPS atual. Um teto curto reviveria
  -- sessões que estão apenas demorando, e duas transcrições simultâneas da
  -- mesma consulta é pior que uma lenta.
  with devolvidas as (
    update myia_listening_sessions
       set status = case when attempts >= p_max_attempts then 'failed' else 'queued' end,
           failure_reason = case
             when attempts >= p_max_attempts
             then 'A transcrição falhou repetidamente. A gravação foi perdida.'
             else null end,
           claimed_at = null, claimed_by = null, updated_at = now()
     where status in ('transcribing', 'drafting')
       and claimed_at is not null
       and claimed_at < now() - make_interval(secs => p_timeout_seconds)
     returning 1
  )
  select count(*) into v_devolvidas from devolvidas;

  return v_devolvidas;
end;
$$;

-- Áudio órfão: worker morreu entre transcrever e apagar o arquivo. Devolve os
-- caminhos para o worker apagar do disco e limpa a coluna.
create or replace function sweep_listening_audio(p_older_than_hours integer default 6)
returns setof text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_service_role() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  return query
  update myia_listening_sessions
     set audio_path = null, updated_at = now()
   where audio_path is not null
     and (status in ('done', 'failed', 'cancelled')
          or updated_at < now() - make_interval(hours => p_older_than_hours))
   returning audio_path;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Permissões
-- ---------------------------------------------------------------------------
-- RLS de 0025 continua valendo: o médico LÊ a própria sessão e não escreve
-- nela. As funções do worker não são concedidas a `authenticated` — um médico
-- que as chamasse cairia em `is_service_role()`, mas negar o EXECUTE é a
-- primeira barreira e custa nada.
grant execute on function enqueue_listening_session(uuid, text) to authenticated, service_role;
grant execute on function is_service_role() to authenticated, service_role;

revoke all on function claim_listening_sessions(text, integer) from public, authenticated;
revoke all on function worker_update_listening_session(uuid, text, text, text) from public, authenticated;
revoke all on function worker_finish_listening_session(uuid, jsonb, text) from public, authenticated;
revoke all on function reap_listening_sessions(integer, integer) from public, authenticated;
revoke all on function sweep_listening_audio(integer) from public, authenticated;

grant execute on function claim_listening_sessions(text, integer) to service_role;
grant execute on function worker_update_listening_session(uuid, text, text, text) to service_role;
grant execute on function worker_finish_listening_session(uuid, jsonb, text) to service_role;
grant execute on function reap_listening_sessions(integer, integer) to service_role;
grant execute on function sweep_listening_audio(integer) to service_role;

comment on table myia_listening_sessions is 'Sessoes de escuta assistida. E tambem a FILA (0027): uma linha por trabalho, reivindicada pelo worker com skip locked. Nunca guardou e continua nao guardando audio: audio_path e um caminho temporario no volume, apagado assim que a transcricao termina.';
