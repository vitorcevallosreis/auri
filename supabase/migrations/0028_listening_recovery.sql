-- ===========================================================================
-- 0028 — Recuperar uma escuta que falhou, a partir da transcrição
--
-- POR QUE.
--
-- 0027 deixou uma lacuna reconhecida: o worker grava a transcrição no banco
-- ANTES de o modelo redigir (ver `processarEscuta`), justamente para que uma
-- falha de redação não leve embora o texto da consulta. Só que nada nunca
-- devolvia esse texto ao médico. A sessão terminava em `failed`, a transcrição
-- ficava na linha, e a única coisa irrepetível do sistema — a consulta — ficava
-- inalcançável.
--
-- Era a pior falha possível aqui: o dado estava salvo e a pessoa que precisava
-- dele não tinha caminho até ele.
--
-- O QUE ESTA MIGRATION FAZ.
--
--   1. `requeue_listening_draft()` — o médico manda redigir de novo a partir
--      da transcrição que já está salva. Sem áudio: ele não existe mais.
--   2. `claim_listening_sessions()` passa a reivindicar essa sessão para
--      `drafting`, não `transcribing` — não há o que transcrever.
--
-- O QUE ELA DELIBERADAMENTE NÃO FAZ.
--
-- Não permite EDITAR a transcrição, e continua não havendo policy de UPDATE
-- para o profissional (0025). A transcrição é a prova de onde o rascunho veio;
-- um rascunho clínico auditável contra uma fonte que o próprio autor pode
-- reescrever não é auditável. Ler e copiar, sim — alterar, não.
--
-- Não retenta sozinha. `processarEscuta` marca `failed` em vez de devolver à
-- fila exatamente porque repetir a mesma redação sem nada ter mudado só gasta o
-- mesmo erro três vezes. Aqui quem decide retentar é uma pessoa, que pode ter
-- corrigido o modelo, a chave ou o teto de tokens no meio.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Redigir de novo — porta do MÉDICO
-- ---------------------------------------------------------------------------
create or replace function requeue_listening_draft(p_session_id uuid)
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

  select * into v_sess from myia_listening_sessions
   where id = p_session_id and professional_id = v_prof and company_id = v_comp
   for update;

  if not found then
    raise exception 'Sessão de escuta não encontrada' using errcode = 'P0002';
  end if;

  -- Só de `failed`. De `queued`/`transcribing`/`drafting` o trabalho já está
  -- em curso e um segundo enfileiramento produziria duas redações concorrentes
  -- da mesma consulta; de `done` existe prontuário e o caminho é editá-lo.
  if v_sess.status <> 'failed' then
    raise exception 'Só uma escuta que falhou pode ser redigida de novo'
      using errcode = '22023';
  end if;

  -- Sem transcrição não há o que redigir: o áudio já foi apagado (0027) e não
  -- há como voltar atrás. Dizer isso aqui evita enfileirar um trabalho que o
  -- worker só descobriria ser impossível depois de reivindicar.
  if coalesce(btrim(v_sess.transcript), '') = '' then
    raise exception 'Esta escuta não chegou a produzir transcrição'
      using errcode = 'P0002';
  end if;

  -- O atendimento pode ter ganhado prontuário manual enquanto isso. Gerar um
  -- segundo aqui esbarraria na unicidade de 0024 lá no fim, depois de gastar
  -- uma chamada ao modelo e com a sessão presa em `drafting` até o reaper.
  if exists (
    select 1 from myia_medical_records where appointment_id = v_sess.appointment_id
  ) then
    raise exception 'Este atendimento já tem prontuário' using errcode = '23505';
  end if;

  update myia_listening_sessions
     set status = 'queued',
         failure_reason = null,
         claimed_at = null,
         claimed_by = null,
         -- Zerado de propósito: `attempts` existe para o reaper não reviver em
         -- laço uma sessão que derruba o worker. Esta tentativa é de uma
         -- pessoa que viu o erro e mudou algo — merece o orçamento cheio.
         attempts = 0,
         -- Continua nulo. É o que faz o worker entender "redigir, não
         -- transcrever", e é a verdade: o arquivo não existe mais.
         audio_path = null,
         updated_at = now()
   where id = p_session_id
   returning * into v_sess;

  return v_sess;
end;
$$;

comment on function requeue_listening_draft(uuid) is
  'Devolve a fila uma escuta que falhou, para redigir de novo a partir da transcricao ja salva. Nao ha audio: ele foi apagado apos a transcricao (0027).';

-- ---------------------------------------------------------------------------
-- 2. O worker precisa saber que este trabalho não tem áudio
-- ---------------------------------------------------------------------------
-- Mesma função de 0027, com uma diferença: o estado em que a sessão é
-- reivindicada passa a depender de haver áudio.
--
-- Não é cosmético. `status` é o que a tela do médico mostra em palavras
-- ("Transcrevendo a consulta…"), e anunciar transcrição num trabalho que só
-- redige descreve errado o que está acontecendo com a consulta dele. Também é
-- o que o reaper lê — e os dois estados já eram tratados igual lá.
-- ---------------------------------------------------------------------------
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
     set status = case when s.audio_path is null then 'drafting' else 'transcribing' end,
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

-- ---------------------------------------------------------------------------
-- 3. Permissões
-- ---------------------------------------------------------------------------
grant execute on function requeue_listening_draft(uuid) to authenticated, service_role;

-- `claim_...` foi recriada acima; o `create or replace` preserva os grants
-- existentes, mas repetir a revogação custa nada e sobrevive a alguém rodar
-- esta migration num banco onde 0027 não passou.
revoke all on function claim_listening_sessions(text, integer) from public, authenticated;
grant execute on function claim_listening_sessions(text, integer) to service_role;
