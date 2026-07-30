-- P3.2 — Prova da migration 0014 (fila de turnos do agente).
-- Convenção do runner (scripts/db-test.mjs): PASS = nenhum statement retorna
-- linha; roda tudo em UMA transação com rollback (self-contained).
--
-- Notas de sintaxe para quem for editar:
--  * `create temp table X as ...` em vez de `select ... into temp X`: INTO só
--    vale antes do FROM em SQL puro.
--  * função que retorna void não pode virar coluna de tabela; por isso a
--    chamada vai num subselect e projetamos um escalar por cima.

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into myia_companies (id, name)
  values ('eeeeeeee-0000-4000-8000-000000000001', 'Empresa Teste 0014');

insert into myia_chat (id, company_id, instance_id)
  values ('eeeeeeee-0000-4000-8000-0000000000a1',
          'eeeeeeee-0000-4000-8000-000000000001', 'inst_0014_a');

insert into myia_chat (id, company_id, instance_id)
  values ('eeeeeeee-0000-4000-8000-0000000000b1',
          'eeeeeeee-0000-4000-8000-000000000001', 'inst_0014_b');

-- ---------------------------------------------------------------------------
-- (1) DEBOUNCE: várias mensagens no mesmo chat = UM job, com run_after adiado
-- ---------------------------------------------------------------------------
-- Asserção central da fase. Sem coalescer, "oi" + "queria marcar" + "amanhã"
-- viram 3 turnos do modelo.
create temp table t_enq1 as select myia_enqueue_agent_turn(
  'eeeeeeee-0000-4000-8000-000000000001',
  'eeeeeeee-0000-4000-8000-0000000000a1', null, 3) as id;

create temp table t_enq2 as select myia_enqueue_agent_turn(
  'eeeeeeee-0000-4000-8000-000000000001',
  'eeeeeeee-0000-4000-8000-0000000000a1', null, 3) as id;

create temp table t_enq3 as select myia_enqueue_agent_turn(
  'eeeeeeee-0000-4000-8000-000000000001',
  'eeeeeeee-0000-4000-8000-0000000000a1', null, 60) as id;

select 'FALHA: 3 enqueues no mesmo chat geraram ' || count(*) || ' jobs (esperado 1)' as erro
from myia_agent_jobs
where chat_id = 'eeeeeeee-0000-4000-8000-0000000000a1'
having count(*) <> 1;

select 'FALHA: enqueue devolveu ids diferentes para o mesmo chat' as erro
from t_enq1, t_enq3
where t_enq1.id is distinct from t_enq3.id;

select 'FALHA: run_after não foi adiado pelo último enqueue' as erro
from myia_agent_jobs
where chat_id = 'eeeeeeee-0000-4000-8000-0000000000a1'
  and run_after < now() + interval '50 seconds';

-- ---------------------------------------------------------------------------
-- (2) Chats diferentes não coalescem entre si
-- ---------------------------------------------------------------------------
create temp table t_enq_b as select myia_enqueue_agent_turn(
  'eeeeeeee-0000-4000-8000-000000000001',
  'eeeeeeee-0000-4000-8000-0000000000b1', null, 3) as id;

select 'FALHA: chats distintos coalesceram (esperado 2 jobs)' as erro
from myia_agent_jobs
where company_id = 'eeeeeeee-0000-4000-8000-000000000001'
having count(*) <> 2;

-- ---------------------------------------------------------------------------
-- (3) CLAIM respeita run_after e marca a posse
-- ---------------------------------------------------------------------------
select 'FALHA: claim pegou job com run_after no futuro' as erro
from myia_claim_agent_jobs('worker-teste', 10);

update myia_agent_jobs
set run_after = now() - interval '1 second'
where company_id = 'eeeeeeee-0000-4000-8000-000000000001';

create temp table t_claimed as
  select count(*) as n from myia_claim_agent_jobs('worker-teste', 10);

select 'FALHA: claim devolveu ' || n || ' jobs (esperado 2)' as erro
from t_claimed where n <> 2;

select 'FALHA: claim não marcou status/locked_by/attempts corretamente' as erro
from myia_agent_jobs
where company_id = 'eeeeeeee-0000-4000-8000-000000000001'
  and (status <> 'running' or locked_by <> 'worker-teste'
       or attempts <> 1 or locked_at is null);

select 'FALHA: segundo claim devolveu job já reivindicado' as erro
from myia_claim_agent_jobs('outro-worker', 10);

-- ---------------------------------------------------------------------------
-- (4) Job em execução NÃO bloqueia enfileirar a próxima mensagem
-- ---------------------------------------------------------------------------
-- O job rodando já leu o histórico dele; a mensagem que acabou de chegar
-- precisa de um turno novo. Por isso o índice único é parcial em 'pending'.
create temp table t_enq_while_running as select myia_enqueue_agent_turn(
  'eeeeeeee-0000-4000-8000-000000000001',
  'eeeeeeee-0000-4000-8000-0000000000a1', null, 30) as id;

select 'FALHA: não criou job novo enquanto o anterior rodava' as erro
from myia_agent_jobs
where chat_id = 'eeeeeeee-0000-4000-8000-0000000000a1'
having count(*) <> 2;

select 'FALHA: deveria haver exatamente 1 pendente para o chat A' as erro
from myia_agent_jobs
where chat_id = 'eeeeeeee-0000-4000-8000-0000000000a1' and status = 'pending'
having count(*) <> 1;

-- ---------------------------------------------------------------------------
-- (5) SUPERSEDE — regressão do bug que este arquivo pegou
-- ---------------------------------------------------------------------------
-- Job A1 roda, chega mensagem nova (A2 pendente), A1 falha. Devolver A1 para
-- 'pending' violaria uq_agent_jobs_pending_chat: o finish estouraria, A1 ficaria
-- presa em 'running' até o reaper e o retry se perderia. O turno novo subsome o
-- antigo, então A1 vira 'superseded' e o pendente é puxado para agora.
create temp table t_job_a as select id from myia_agent_jobs
where chat_id = 'eeeeeeee-0000-4000-8000-0000000000a1' and status = 'running' limit 1;

create temp table t_void_0 as select 1 as ok from (
  select myia_finish_agent_job((select id from t_job_a), false, 'falhou com turno novo na fila')
) s;

select 'FALHA: job com turno mais novo deveria virar superseded, virou ' || status as erro
from myia_agent_jobs
where id = (select id from t_job_a) and status <> 'superseded';

-- O pendente foi puxado para agora: uma falha não pode atrasar a resposta ao
-- paciente pelo tempo do debounce.
select 'FALHA: pendente não foi puxado para execução imediata' as erro
from myia_agent_jobs
where chat_id = 'eeeeeeee-0000-4000-8000-0000000000a1'
  and status = 'pending' and run_after > now();

-- ---------------------------------------------------------------------------
-- (6) FINISH — sucesso, e falha com backoff quando NÃO há turno mais novo
-- ---------------------------------------------------------------------------
create temp table t_job_b as select id from myia_agent_jobs
where chat_id = 'eeeeeeee-0000-4000-8000-0000000000b1' limit 1;

create temp table t_void_1 as select 1 as ok from (
  select myia_finish_agent_job((select id from t_job_b), true, null)
) s;

select 'FALHA: finish(ok) não marcou done' as erro
from myia_agent_jobs
where id = (select id from t_job_b) and status <> 'done';

-- Chat B não tem pendente: caminho de backoff normal.
update myia_agent_jobs
set status = 'running', attempts = 1, locked_at = now(), locked_by = 'w'
where id = (select id from t_job_b);

create temp table t_void_2 as select 1 as ok from (
  select myia_finish_agent_job((select id from t_job_b), false, 'erro simulado')
) s;

select 'FALHA: finish(erro) sem turno novo deveria voltar para pending' as erro
from myia_agent_jobs
where id = (select id from t_job_b) and status <> 'pending';

select 'FALHA: backoff não adiou o run_after' as erro
from myia_agent_jobs
where id = (select id from t_job_b) and run_after <= now();

select 'FALHA: erro não foi registrado em last_error' as erro
from myia_agent_jobs
where id = (select id from t_job_b) and last_error is distinct from 'erro simulado';

-- Esgotar tentativas leva a 'failed', não a retry infinito.
update myia_agent_jobs
set status = 'running', attempts = max_attempts
where id = (select id from t_job_b);

create temp table t_void_3 as select 1 as ok from (
  select myia_finish_agent_job((select id from t_job_b), false, 'ultimo erro')
) s;

select 'FALHA: tentativas esgotadas não marcaram failed' as erro
from myia_agent_jobs
where id = (select id from t_job_b) and status <> 'failed';

-- ---------------------------------------------------------------------------
-- (7) REAP — worker morto não pode deixar chat mudo para sempre
-- ---------------------------------------------------------------------------
-- Chat B, sem pendente: revive.
update myia_agent_jobs
set status = 'running', attempts = 1, max_attempts = 3,
    locked_at = now() - interval '1 hour', locked_by = 'worker-morto'
where id = (select id from t_job_b);

create temp table t_reaped as select myia_reap_stale_agent_jobs(300) as n;

select 'FALHA: reap devolveu ' || n || ' (esperado 1)' as erro
from t_reaped where n <> 1;

select 'FALHA: job travado não voltou para pending' as erro
from myia_agent_jobs
where id = (select id from t_job_b) and status <> 'pending';

-- Travado E sem tentativas sobrando vira failed, não volta para a fila.
update myia_agent_jobs
set status = 'running', attempts = 3, max_attempts = 3,
    locked_at = now() - interval '1 hour', locked_by = 'worker-morto'
where id = (select id from t_job_b);

create temp table t_void_4 as select 1 as ok from (
  select myia_reap_stale_agent_jobs(300)
) s;

select 'FALHA: job travado sem tentativas deveria virar failed' as erro
from myia_agent_jobs
where id = (select id from t_job_b) and status <> 'failed';

-- Travado COM turno mais novo na fila vira superseded, não pending — mesma
-- colisão de índice do caso (5), agora pelo caminho do reaper.
update myia_agent_jobs
set status = 'running', attempts = 1, max_attempts = 3,
    locked_at = now() - interval '1 hour', locked_by = 'worker-morto'
where id = (select id from t_job_a);

create temp table t_void_5 as select 1 as ok from (
  select myia_reap_stale_agent_jobs(300)
) s;

select 'FALHA: reap com turno novo na fila deveria marcar superseded, marcou ' || status as erro
from myia_agent_jobs
where id = (select id from t_job_a) and status <> 'superseded';

-- Job recém-travado (dentro do timeout) NÃO pode ser colhido.
update myia_agent_jobs
set status = 'running', attempts = 1, locked_at = now(), locked_by = 'worker-vivo'
where id = (select id from t_job_b);

select 'FALHA: reap colheu job dentro do timeout' as erro
from myia_agent_jobs
where id = (select id from t_job_b)
  and (select myia_reap_stale_agent_jobs(300)) > 0;

-- ---------------------------------------------------------------------------
-- (8) A fila é infraestrutura — cliente não toca
-- ---------------------------------------------------------------------------
select 'FALHA: ' || r || ' tem acesso à tabela myia_agent_jobs' as erro
from unnest(array['anon','authenticated']) as r
where has_table_privilege(r, 'myia_agent_jobs', 'SELECT')
   or has_table_privilege(r, 'myia_agent_jobs', 'INSERT');

-- Sem revoke, qualquer usuário logado enfileiraria turnos e queimaria tokens.
select 'FALHA: ' || r || ' pode executar ' || f as erro
from unnest(array['anon','authenticated']) as r,
     unnest(array[
       'myia_enqueue_agent_turn(uuid, uuid, uuid, integer)',
       'myia_claim_agent_jobs(text, integer)',
       'myia_finish_agent_job(uuid, boolean, text)',
       'myia_reap_stale_agent_jobs(integer)'
     ]) as f
where has_function_privilege(r, f, 'EXECUTE');

select 'FALHA: service_role NÃO pode executar ' || f as erro
from unnest(array[
       'myia_enqueue_agent_turn(uuid, uuid, uuid, integer)',
       'myia_claim_agent_jobs(text, integer)',
       'myia_finish_agent_job(uuid, boolean, text)',
       'myia_reap_stale_agent_jobs(integer)'
     ]) as f
where not has_function_privilege('service_role', f, 'EXECUTE');
