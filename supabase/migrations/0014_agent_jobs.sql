-- Plano 3 (P3.2) — Fila de turnos do agente.
--
-- Por que uma tabela própria e não pgmq: o requisito central desta fase não é
-- "entregar uma mensagem uma vez", é **debounce com coalescência por chat**. O
-- paciente manda "oi", "queria marcar", "amanhã de manhã" em 3 segundos; sem
-- coalescer, isso vira 3 turnos do modelo (3x custo, respostas atropeladas e
-- fora de ordem). Fila genérica não tem essa primitiva — aqui ela é um índice
-- único parcial por chat_id + um run_after que é empurrado para frente a cada
-- nova mensagem.
--
-- A concorrência mora no banco de propósito. `for update skip locked` dá
-- claim atômico entre vários workers sem lock distribuído; deixar isso no
-- código do worker significaria dois workers pegando o mesmo chat.

create table if not exists myia_agent_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,
  chat_id uuid not null references myia_chat(id) on delete cascade,
  assistant_id uuid references myia_assistants(id) on delete set null,

  status text not null default 'pending',

  -- Momento a partir do qual o job pode ser reivindicado. É o debounce.
  run_after timestamptz not null default now(),

  attempts integer not null default 0,
  max_attempts integer not null default 3,

  -- Preenchidos no claim; usados para detectar worker morto.
  locked_at timestamptz,
  locked_by text,

  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A constraint fica FORA do create table de propósito: com `if not exists`, um
-- create table que não roda (tabela já existe) também não aplica a constraint,
-- e a migration deixaria de ser reexecutável depois de mudar os status aceitos.
--
-- 'superseded': o job não completou, mas um turno MAIS NOVO já está enfileirado
-- para o mesmo chat e vai ler o histórico inteiro — inclusive o que este
-- trataria. Não é sucesso nem falha; ver myia_finish_agent_job.
alter table myia_agent_jobs
  drop constraint if exists myia_agent_jobs_status_check;

alter table myia_agent_jobs
  add constraint myia_agent_jobs_status_check
  check (status in ('pending', 'running', 'done', 'failed', 'superseded'));

-- ---------------------------------------------------------------------------
-- Coalescência: no máximo UM job pendente por chat
-- ---------------------------------------------------------------------------
-- Parcial de propósito. Enquanto um job roda, uma mensagem nova precisa poder
-- criar OUTRO pendente — o job em execução já leu o histórico dele e não vai
-- enxergar a mensagem que acabou de chegar.
create unique index if not exists uq_agent_jobs_pending_chat
  on myia_agent_jobs (chat_id)
  where status = 'pending';

-- Ordem de consumo da fila.
create index if not exists idx_agent_jobs_claimable
  on myia_agent_jobs (run_after)
  where status = 'pending';

-- Varredura de jobs travados.
create index if not exists idx_agent_jobs_running
  on myia_agent_jobs (locked_at)
  where status = 'running';

create index if not exists idx_agent_jobs_company
  on myia_agent_jobs (company_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS e grants
-- ---------------------------------------------------------------------------
-- Fila é infraestrutura: o cliente não lê nem escreve. RLS fica ligada como
-- defesa em profundidade, mas o acesso real é negado no nível de tabela.
alter table myia_agent_jobs enable row level security;

drop policy if exists myia_agent_jobs_tenant_all on myia_agent_jobs;

create policy myia_agent_jobs_tenant_all on myia_agent_jobs
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

revoke all on myia_agent_jobs from anon, authenticated;
grant all on myia_agent_jobs to service_role;

-- ---------------------------------------------------------------------------
-- enqueue — chamado pelo webhook a cada mensagem recebida
-- ---------------------------------------------------------------------------
-- Upsert no índice parcial. Segunda mensagem no mesmo chat NÃO cria job novo:
-- empurra o run_after do pendente, adiando o turno até o paciente parar de
-- digitar. É o debounce.
--
-- Está em função (e não no supabase-js) porque o PostgREST não consegue mirar
-- índice PARCIAL via onConflict — não carrega o predicado `where status =
-- 'pending'`. Mesma limitação já documentada no ingress.
create or replace function myia_enqueue_agent_turn(
  p_company_id uuid,
  p_chat_id uuid,
  p_assistant_id uuid default null,
  p_debounce_seconds integer default 3
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into myia_agent_jobs (company_id, chat_id, assistant_id, run_after)
  values (
    p_company_id,
    p_chat_id,
    p_assistant_id,
    now() + make_interval(secs => p_debounce_seconds)
  )
  on conflict (chat_id) where status = 'pending'
  do update set
    run_after = excluded.run_after,
    -- Um chat pode trocar de assistente entre mensagens; vale o mais recente.
    assistant_id = coalesce(excluded.assistant_id, myia_agent_jobs.assistant_id),
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- claim — worker reivindica lote de jobs prontos
-- ---------------------------------------------------------------------------
-- `for update skip locked` é o que permite N workers sem coordenação externa:
-- cada um pula as linhas que outro já travou em vez de bloquear.
create or replace function myia_claim_agent_jobs(
  p_worker_id text,
  p_limit integer default 5
)
returns setof myia_agent_jobs
language sql
as $$
  update myia_agent_jobs j
  set status = 'running',
      locked_at = now(),
      locked_by = p_worker_id,
      attempts = j.attempts + 1,
      updated_at = now()
  where j.id in (
    select id from myia_agent_jobs
    where status = 'pending'
      and run_after <= now()
    order by run_after
    for update skip locked
    limit p_limit
  )
  returning j.*;
$$;

-- ---------------------------------------------------------------------------
-- finish — sucesso, ou falha com retry exponencial
-- ---------------------------------------------------------------------------
create or replace function myia_finish_agent_job(
  p_job_id uuid,
  p_ok boolean,
  p_error text default null
)
returns void
language plpgsql
as $$
declare
  v_attempts integer;
  v_max integer;
  v_chat_id uuid;
  v_has_newer boolean;
begin
  if p_ok then
    update myia_agent_jobs
    set status = 'done', last_error = null, locked_by = null, updated_at = now()
    where id = p_job_id;
    return;
  end if;

  select attempts, max_attempts, chat_id
    into v_attempts, v_max, v_chat_id
  from myia_agent_jobs where id = p_job_id;

  if v_attempts is null then
    return;
  end if;

  if v_attempts >= v_max then
    -- Esgotou. Fica em 'failed' para inspeção; não some silenciosamente.
    update myia_agent_jobs
    set status = 'failed', last_error = p_error, locked_by = null, updated_at = now()
    where id = p_job_id;
    return;
  end if;

  -- Enquanto este job rodava, chegou mensagem nova e um turno mais novo foi
  -- enfileirado? Então devolver este para 'pending' violaria
  -- uq_agent_jobs_pending_chat — e, pior, seria redundante: o turno novo lê o
  -- histórico inteiro, incluindo o que este trataria.
  select exists (
    select 1 from myia_agent_jobs
    where chat_id = v_chat_id and status = 'pending' and id <> p_job_id
  ) into v_has_newer;

  if v_has_newer then
    update myia_agent_jobs
    set status = 'superseded',
        last_error = p_error,
        locked_at = null,
        locked_by = null,
        updated_at = now()
    where id = p_job_id;

    -- O retry não deve esperar o debounce do turno novo: puxa para agora, senão
    -- uma falha atrasa a resposta ao paciente pelo tempo do debounce.
    update myia_agent_jobs
    set run_after = least(run_after, now()), updated_at = now()
    where chat_id = v_chat_id and status = 'pending';

    return;
  end if;

  -- Backoff exponencial: 10s, 20s, 40s...
  update myia_agent_jobs
  set status = 'pending',
      last_error = p_error,
      locked_at = null,
      locked_by = null,
      run_after = now() + make_interval(secs => 10 * power(2, v_attempts)::integer),
      updated_at = now()
  where id = p_job_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- reap — devolve à fila o que ficou preso em 'running'
-- ---------------------------------------------------------------------------
-- Worker morto (deploy, OOM, crash) deixa job em 'running' para sempre. Sem
-- isso, aquele chat nunca mais é atendido.
create or replace function myia_reap_stale_agent_jobs(
  p_timeout_seconds integer default 300
)
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  -- Mesma armadilha do finish: se já existe um pendente para o chat, devolver
  -- este para 'pending' bate em uq_agent_jobs_pending_chat. O turno mais novo
  -- subsome este, então marcamos 'superseded' em vez de reviver.
  update myia_agent_jobs j
  set status = 'superseded',
      locked_at = null,
      locked_by = null,
      last_error = 'reaped: worker travado, turno mais novo assume',
      updated_at = now()
  where j.status = 'running'
    and j.locked_at < now() - make_interval(secs => p_timeout_seconds)
    and exists (
      select 1 from myia_agent_jobs n
      where n.chat_id = j.chat_id and n.status = 'pending'
    );

  with revived as (
    update myia_agent_jobs j
    set status = 'pending',
        locked_at = null,
        locked_by = null,
        last_error = 'reaped: worker não finalizou o job',
        run_after = now(),
        updated_at = now()
    where j.status = 'running'
      and j.locked_at < now() - make_interval(secs => p_timeout_seconds)
      -- Só volta para a fila se ainda houver tentativa. Senão, 'failed'.
      and j.attempts < j.max_attempts
    returning 1
  )
  select count(*) into v_count from revived;

  update myia_agent_jobs
  set status = 'failed',
      locked_by = null,
      last_error = 'reaped: tentativas esgotadas com o worker travado',
      updated_at = now()
  where status = 'running'
    and locked_at < now() - make_interval(secs => p_timeout_seconds)
    and attempts >= max_attempts;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Execução restrita ao servidor
-- ---------------------------------------------------------------------------
-- Funções nascem com EXECUTE para PUBLIC. Sem o revoke, qualquer usuário
-- logado poderia enfileirar turnos de agente (e queimar tokens) à vontade.
revoke all on function myia_enqueue_agent_turn(uuid, uuid, uuid, integer) from public, anon, authenticated;
revoke all on function myia_claim_agent_jobs(text, integer) from public, anon, authenticated;
revoke all on function myia_finish_agent_job(uuid, boolean, text) from public, anon, authenticated;
revoke all on function myia_reap_stale_agent_jobs(integer) from public, anon, authenticated;

grant execute on function myia_enqueue_agent_turn(uuid, uuid, uuid, integer) to service_role;
grant execute on function myia_claim_agent_jobs(text, integer) to service_role;
grant execute on function myia_finish_agent_job(uuid, boolean, text) to service_role;
grant execute on function myia_reap_stale_agent_jobs(integer) to service_role;
