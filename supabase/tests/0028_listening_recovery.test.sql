-- Recuperar escuta que falhou (0028).
--
-- A asserção que dá nome a esta suíte: A TRANSCRIÇÃO SOBREVIVE À FALHA E O
-- MÉDICO ALCANÇA ELA — mas continua sem poder reescrevê-la. As duas metades
-- importam. Se a primeira quebrar, uma consulta se perde; se a segunda
-- quebrar, o rascunho clínico deixa de ser auditável contra a fonte, porque a
-- fonte passa a ser editável por quem assina o rascunho.
--
-- A segunda asserção: REDIGIR DE NOVO NÃO É TRANSCREVER DE NOVO. Não há áudio
-- — 0027 o apaga assim que transcreve. Uma sessão devolvida à fila sem
-- `audio_path` tem que ser reivindicada como `drafting`, senão a tela anuncia
-- ao médico uma transcrição que não vai acontecer.
--
-- Convenção do runner: qualquer linha retornada é uma falha de asserção.

create temporary table t_falhas (msg text) on commit drop;

create temporary table t on commit drop as
select
  u.id              as user_a,
  u.professional_id as prof_a,
  u.company_id      as comp_a,
  (select id from myia_record_templates where id = '7e000000-0000-4000-8000-000000000001') as tpl
from myia_users u
where u.role = 'professional' and u.professional_id is not null
order by u.created_at limit 1;

alter table t add column appt_livre uuid;
alter table t add column appt_com_prontuario uuid;

update t set
  appt_livre = (
    select a.id from myia_appointments a
     where a.professional_id = t.prof_a and a.status <> 'cancelled'
       and not exists (select 1 from myia_medical_records m where m.appointment_id = a.id)
       and not exists (select 1 from myia_listening_sessions s where s.appointment_id = a.id)
     limit 1),
  -- Para o caso em que o atendimento ganhou prontuário por outro caminho
  -- enquanto a escuta estava parada em `failed`.
  appt_com_prontuario = (
    select m.appointment_id from myia_medical_records m
     join myia_appointments a on a.id = m.appointment_id
     where a.professional_id = t.prof_a
       and not exists (select 1 from myia_listening_sessions s where s.appointment_id = a.id)
     limit 1);

select 'seed insuficiente para exercitar a recuperação da escuta'
  where exists (select 1 from t where user_a is null or appt_livre is null or tpl is null);

grant select on t to authenticated;
grant insert on t_falhas to authenticated;

-- --------------------------------------------------------------------------
-- Montagem: levar uma sessão até `failed` COM transcrição, que é exatamente o
-- estado que 0027 produz quando a redação falha depois de transcrever.
-- --------------------------------------------------------------------------
do $montagem$
declare
  v_t    record;
  v_sess myia_listening_sessions;
begin
  select * into v_t from t;

  -- lado do médico: abre e entrega o áudio
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_t.user_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_sess := start_listening_session(v_t.appt_livre, v_t.tpl, 'verbal', null);
  v_sess := enqueue_listening_session(v_sess.id, '/dados/escuta/recuperacao.webm');
  perform set_config('request.jwt.claims', null, true);
  execute 'reset role';

  -- lado do worker: transcreve e a REDAÇÃO falha
  perform set_config('request.jwt.claims',
    json_build_object('role', 'service_role')::text, true);
  perform claim_listening_sessions('worker-montagem', 5);
  perform worker_update_listening_session(
    v_sess.id, 'drafting', 'Paciente relata dor torácica há dois dias.', null);
  perform worker_update_listening_session(
    v_sess.id, 'failed', null, 'A redação do rascunho falhou.');
  -- É o worker quem limpa o arquivo; sem isso o teste não reproduziria o
  -- estado real, e a asserção do `drafting` passaria por engano.
  update myia_listening_sessions set audio_path = null where id = v_sess.id;
  perform set_config('request.jwt.claims', null, true);
end;
$montagem$;

-- 1. A transcrição sobreviveu à falha. É a razão de 0027 gravá-la antes de
--    redigir, e a razão de esta suíte existir.
select 'a transcrição não sobreviveu à falha da redação'
  from myia_listening_sessions s
  join t on t.appt_livre = s.appointment_id
 where s.status = 'failed' and coalesce(btrim(s.transcript), '') = '';

-- --------------------------------------------------------------------------
-- 2. Atendimento que já ganhou prontuário por outro caminho: redigir de novo é
--    recusado ANTES de gastar uma chamada ao modelo.
--
-- Este cenário vem ANTES da bateria principal de propósito: ele precisa de um
-- `claim`, e `claim` leva o que estiver na fila — inclusive a sessão que a
-- bateria seguinte vai devolver para lá. Rodando aqui, a única sessão `queued`
-- no momento é a deste bloco.
-- --------------------------------------------------------------------------
do $jatem$
declare
  v_t     record;
  v_outra myia_listening_sessions;
begin
  select * into v_t from t;
  if v_t.appt_com_prontuario is null then return; end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_t.user_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_outra := start_listening_session(v_t.appt_com_prontuario, v_t.tpl, 'verbal', null);
  v_outra := enqueue_listening_session(v_outra.id, '/dados/escuta/outra.webm');
  perform set_config('request.jwt.claims', null, true);
  execute 'reset role';

  perform set_config('request.jwt.claims',
    json_build_object('role', 'service_role')::text, true);
  perform claim_listening_sessions('worker-montagem-2', 5);
  perform worker_update_listening_session(v_outra.id, 'failed', 'Texto qualquer.', 'falhou');
  update myia_listening_sessions set audio_path = null where id = v_outra.id;
  perform set_config('request.jwt.claims', null, true);

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_t.user_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    perform requeue_listening_draft(v_outra.id);
    insert into t_falhas values ('redigiu de novo escuta de atendimento que já tem prontuário');
  exception when unique_violation then null;
  end;
  perform set_config('request.jwt.claims', null, true);
  execute 'reset role';
end;
$jatem$;

-- ------------------------------------------------------ bateria do MÉDICO
do $medico$
declare
  v_t     record;
  v_sess  myia_listening_sessions;
begin
  select * into v_t from t;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_t.user_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select * into v_sess from myia_listening_sessions
   where appointment_id = v_t.appt_livre;

  -- 2. O médico LÊ a transcrição da própria sessão falhada. Sem isto, o texto
  --    está salvo e inalcançável — que era o defeito que 0028 conserta.
  if coalesce(btrim(v_sess.transcript), '') = '' then
    insert into t_falhas values ('médico não enxerga a transcrição da sessão que falhou');
  end if;

  -- 3. Redigir de novo devolve à fila, limpa o motivo da falha e zera o
  --    orçamento de tentativas.
  v_sess := requeue_listening_draft(v_sess.id);
  if v_sess.status is distinct from 'queued'
     or v_sess.failure_reason is not null
     or v_sess.attempts <> 0
     or v_sess.claimed_by is not null then
    insert into t_falhas values ('redigir de novo não devolveu a sessão à fila corretamente');
  end if;

  -- 4. E NÃO ressuscita áudio. Um caminho aqui apontaria para um arquivo que
  --    não existe mais, e o worker tentaria lê-lo.
  if v_sess.audio_path is not null then
    insert into t_falhas values ('redigir de novo repôs audio_path');
  end if;

  -- 5. A transcrição continua fora do alcance de UPDATE direto (regressão de
  --    0025). 0028 dá LEITURA ao médico, não escrita.
  begin
    update myia_listening_sessions set transcript = 'reescrito' where id = v_sess.id;
    if found then
      insert into t_falhas values ('médico reescreveu a transcrição por UPDATE direto');
    end if;
  exception when insufficient_privilege then null;
  end;

  -- 6. Já está na fila: pedir de novo seria uma segunda redação concorrente da
  --    mesma consulta.
  begin
    perform requeue_listening_draft(v_sess.id);
    insert into t_falhas values ('aceitou redigir de novo uma sessão que já está na fila');
  exception when invalid_parameter_value then null;
  end;

  -- 7. Sessão de outra pessoa não existe daqui. `P0002` e não `42501`: quem
  --    não pode ver não deve nem descobrir que a linha existe.
  begin
    perform requeue_listening_draft('00000000-0000-4000-8000-0000000000ff'::uuid);
    insert into t_falhas values ('redigiu de novo uma sessão que não é sua');
  exception when no_data_found then null;
  end;

  perform set_config('request.jwt.claims', null, true);
  execute 'reset role';
end;
$medico$;

-- ------------------------------------------------------ bateria do WORKER
do $worker$
declare
  v_t    record;
  v_sess myia_listening_sessions;
  v_lote myia_listening_sessions;
begin
  select * into v_t from t;
  perform set_config('request.jwt.claims',
    json_build_object('role', 'service_role')::text, true);

  select * into v_sess from myia_listening_sessions
   where appointment_id = v_t.appt_livre;

  if v_sess.status is distinct from 'queued' then
    insert into t_falhas values ('a sessão redigida de novo não chegou como queued ao worker');
    return;
  end if;

  -- 9. A asserção central: sem áudio, o claim leva a `drafting`. Em
  --    `transcribing` a tela diria ao médico "Transcrevendo a consulta…" num
  --    trabalho que não tem o que transcrever.
  select * into v_lote from claim_listening_sessions('worker-redacao', 5)
   where id = v_sess.id;
  if v_lote.status is distinct from 'drafting' then
    insert into t_falhas values (
      'sessão sem áudio foi reivindicada como ' || coalesce(v_lote.status, '(nada)'));
  end if;

  -- 10. E a transcrição chegou ao worker pelo próprio claim — é dela que a
  --     redação parte, já que o arquivo não existe mais.
  if coalesce(btrim(v_lote.transcript), '') = '' then
    insert into t_falhas values ('o claim não devolveu a transcrição ao worker');
  end if;

  perform set_config('request.jwt.claims', null, true);
end;
$worker$;

-- 11. O médico não pode chamar a porta do worker por esta via nova.
do $barreira$
declare
  v_t record;
begin
  select * into v_t from t;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_t.user_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  begin
    perform claim_listening_sessions('worker-falso', 1);
    insert into t_falhas values ('médico reivindicou sessão pela claim recriada em 0028');
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', null, true);
  execute 'reset role';
end;
$barreira$;

select msg from t_falhas;
