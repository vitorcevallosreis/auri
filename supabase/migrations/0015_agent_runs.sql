-- Plano 3 (P3.3) — Observabilidade do turno do agente.
--
-- Sem isto não há como responder "quanto custa uma conversa", "por que o agente
-- respondeu isso" nem "qual tool falhou". É a base do painel de custo do P3.8:
-- COGS por conversa sai de somar os runs, sem instrumentação adicional depois.

create table if not exists myia_agent_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,
  assistant_id uuid references myia_assistants(id) on delete set null,
  chat_id uuid not null references myia_chat(id) on delete cascade,
  job_id uuid references myia_agent_jobs(id) on delete set null,

  -- Agrupador de cobrança (janela de 24h). A tabela myia_conversations só nasce
  -- no P3.8; a coluna já existe aqui para que os runs gravados desde agora
  -- sejam atribuíveis retroativamente, sem migração de dados depois.
  conversation_id uuid,

  model text not null,
  effort text,

  status text not null default 'running',
  stop_reason text,

  -- Contagem separada de cache: sem isso não dá para saber se o prompt caching
  -- está funcionando. cache_read perto de zero em turnos repetidos significa
  -- que algo volátil entrou antes do breakpoint.
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,

  -- Quantas idas ao modelo o turno consumiu (cada tool call gera outra).
  iterations integer not null default 0,

  latency_ms integer,
  error text,

  created_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table myia_agent_runs
  drop constraint if exists myia_agent_runs_status_check;

alter table myia_agent_runs
  add constraint myia_agent_runs_status_check
  check (status in ('running', 'ok', 'error'));

create index if not exists idx_agent_runs_company_created
  on myia_agent_runs (company_id, created_at desc);

create index if not exists idx_agent_runs_chat
  on myia_agent_runs (chat_id, created_at desc);

create index if not exists idx_agent_runs_conversation
  on myia_agent_runs (conversation_id)
  where conversation_id is not null;

-- ---------------------------------------------------------------------------
-- Chamadas de tool
-- ---------------------------------------------------------------------------
-- Guardar input e output de cada tool é o que permite responder "por que o
-- agente ofereceu esse horário": dá para reproduzir a decisão sem adivinhar.
create table if not exists myia_agent_tool_calls (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references myia_agent_runs(id) on delete cascade,

  tool_name text not null,
  input jsonb,
  output jsonb,
  is_error boolean not null default false,
  duration_ms integer,

  created_at timestamptz not null default now()
);

create index if not exists idx_agent_tool_calls_run
  on myia_agent_tool_calls (run_id, created_at);

-- ---------------------------------------------------------------------------
-- RLS e grants
-- ---------------------------------------------------------------------------
-- A clínica PODE ver os próprios runs (é o dado do painel de custo do P3.8),
-- mas quem escreve é só o worker.
alter table myia_agent_runs enable row level security;
alter table myia_agent_tool_calls enable row level security;

drop policy if exists myia_agent_runs_tenant_read on myia_agent_runs;

create policy myia_agent_runs_tenant_read on myia_agent_runs
  for select using (company_id = auth_company_id());

drop policy if exists myia_agent_tool_calls_tenant_read on myia_agent_tool_calls;

create policy myia_agent_tool_calls_tenant_read on myia_agent_tool_calls
  for select using (
    exists (
      select 1 from myia_agent_runs r
      where r.id = run_id and r.company_id = auth_company_id()
    )
  );

-- Leitura sim, escrita não: o histórico de execução não pode ser editado pelo
-- cliente — é registro de cobrança e de auditoria.
revoke all on myia_agent_runs from anon, authenticated;
revoke all on myia_agent_tool_calls from anon, authenticated;

grant select on myia_agent_runs to authenticated;
grant select on myia_agent_tool_calls to authenticated;

grant all on myia_agent_runs to service_role;
grant all on myia_agent_tool_calls to service_role;
