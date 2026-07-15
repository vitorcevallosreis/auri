# Plano 1 — Migração Supabase + Religar Painel (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subir um projeto Supabase que nós controlamos, com o schema completo do myia_app reconstruído do zero + RLS multi-tenant, e o painel Next.js religado e funcionando (login + CRUD).

**Architecture:** Reconstruímos o schema (~20 tabelas `myia_*`) como migrations SQL versionadas em `supabase/migrations/`. Testamos localmente com a Supabase CLI (`supabase db reset` numa stack local em Docker), aplicando domínio por domínio. Tenancy multi-tenant via tabela `myia_users` (liga `auth.users` → `company_id`) + função `auth_company_id()` usada em todas as políticas de RLS. Depois criamos o projeto na nuvem, damos `db push`, religamos `.env.local` e fazemos smoke test do painel.

**Tech Stack:** Supabase (Postgres 15 + CLI), Docker, Next.js 15.1.6, `@supabase/supabase-js`, `@supabase/auth-helpers-nextjs`.

## Global Constraints

- Toda tabela usa prefixo `myia_`.
- PK: `id uuid primary key default gen_random_uuid()` (salvo `myia_users`, cuja PK referencia `auth.users`).
- Timestamps: `timestamptz`, default `now()` para `created_at`.
- Toda tabela de tenant tem `company_id uuid not null references myia_companies(id) on delete cascade`.
- RLS **habilitado** em todas as tabelas de tenant; isolamento por `company_id = auth_company_id()`.
- Migrations são idempotentes onde possível (`create table if not exists`, `create or replace function`).
- O schema é reconstruído a partir dos interfaces TS (fonte de verdade), não de um dump — não há dados legados a preservar.

---

### Task 0: Bootstrap da Supabase CLI local

**Files:**
- Create: `supabase/config.toml` (gerado pela CLI)
- Create: `supabase/migrations/` (diretório)
- Modify: `package.json` (adicionar scripts `db:reset`, `db:new`)
- Modify: `.gitignore` (ignorar artefatos locais da CLI)

**Interfaces:**
- Consumes: nada.
- Produces: stack Postgres local em `postgresql://postgres:postgres@127.0.0.1:54322/postgres`; comando `supabase db reset` que aplica todas as migrations em ordem.

- [ ] **Step 1: Instalar a Supabase CLI (se necessário) e inicializar**

Run:
```bash
brew install supabase/tap/supabase   # se ainda não instalado
cd "myia_app-develop"
supabase init
```
Expected: cria `supabase/config.toml` e `supabase/` (responde "n" para geração de VS Code settings se perguntar).

- [ ] **Step 2: Subir a stack local**

Run: `supabase start`
Expected: sobe containers Docker e imprime `API URL`, `DB URL`, `anon key`, `service_role key`. Guardar essas chaves (uso local).

- [ ] **Step 3: Adicionar scripts ao package.json**

Em `package.json`, dentro de `"scripts"`, adicionar:
```json
"db:new": "supabase migration new",
"db:reset": "supabase db reset",
"db:diff": "supabase db diff"
```

- [ ] **Step 4: Ignorar artefatos locais no .gitignore**

Adicionar ao final de `.gitignore`:
```
# supabase local
supabase/.branches
supabase/.temp
```

- [ ] **Step 5: Verificar que db reset roda com zero migrations**

Run: `supabase db reset`
Expected: PASS — "Resetting local database..." termina sem erro (ainda não há tabelas `myia_*`).

- [ ] **Step 6: Commit**

```bash
git add supabase/config.toml package.json .gitignore
git commit -m "chore: bootstrap supabase CLI local dev"
```

---

### Task 1: Fundação de tenancy (companies + users + auth_company_id)

**Files:**
- Create: `supabase/migrations/0001_tenancy.sql`
- Create: `supabase/tests/0001_tenancy.test.sql`

**Interfaces:**
- Consumes: `auth.users` (schema nativo do Supabase).
- Produces:
  - Tabela `myia_companies(id, name, description, site_url, domain_server, created_at)`.
  - Tabela `myia_users(id references auth.users, company_id, role, created_at)`.
  - Função `auth_company_id() returns uuid` — retorna o `company_id` do `auth.uid()` atual. Usada por TODAS as policies das tarefas seguintes.

- [ ] **Step 1: Escrever o teste que falha**

Create `supabase/tests/0001_tenancy.test.sql`:
```sql
-- Falha se a função de tenancy não existir
select 'auth_company_id ausente' where not exists (
  select 1 from pg_proc where proname = 'auth_company_id'
);
-- Falha se as tabelas não existirem
select 'myia_companies ausente' where to_regclass('public.myia_companies') is null;
select 'myia_users ausente'     where to_regclass('public.myia_users') is null;
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/0001_tenancy.test.sql`
Expected: FAIL — imprime as três linhas de "ausente".

- [ ] **Step 3: Escrever a migration**

Create `supabase/migrations/0001_tenancy.sql`:
```sql
create table if not exists myia_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  site_url text,
  domain_server text,
  created_at timestamptz not null default now()
);

create table if not exists myia_users (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references myia_companies(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now()
);
create index if not exists idx_myia_users_company on myia_users(company_id);

-- Retorna o company_id do usuário autenticado atual (para RLS).
create or replace function auth_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from myia_users where id = auth.uid();
$$;

alter table myia_companies enable row level security;
alter table myia_users enable row level security;

create policy company_select_own on myia_companies
  for select using (id = auth_company_id());
create policy company_update_own on myia_companies
  for update using (id = auth_company_id());

create policy users_select_own_company on myia_users
  for select using (company_id = auth_company_id());
```

- [ ] **Step 4: Aplicar e ver passar**

Run: `supabase db reset && psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/0001_tenancy.test.sql`
Expected: PASS — a query de teste retorna zero linhas.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_tenancy.sql supabase/tests/0001_tenancy.test.sql
git commit -m "feat(db): tenancy foundation (companies, users, auth_company_id)"
```

---

### Task 2: Domínio Assistentes (assistants, llms, settings, channels)

**Files:**
- Create: `supabase/migrations/0002_assistants.sql`
- Create: `supabase/tests/0002_assistants.test.sql`

**Interfaces:**
- Consumes: `myia_companies` (Task 1).
- Produces: tabelas `myia_assistants`, `myia_assistants_llms`, `myia_settings_assistants`, `myia_channels` — colunas exatamente como consumidas pelo painel (ver `src/contexts/Assistants/interfaces.ts`).

- [ ] **Step 1: Escrever o teste que falha**

Create `supabase/tests/0002_assistants.test.sql`:
```sql
select 'myia_assistants ausente' where to_regclass('public.myia_assistants') is null;
select 'coluna step_by_step ausente' where not exists (
  select 1 from information_schema.columns
  where table_name='myia_assistants' and column_name='step_by_step');
select 'myia_channels ausente' where to_regclass('public.myia_channels') is null;
select 'myia_assistants_llms ausente' where to_regclass('public.myia_assistants_llms') is null;
select 'myia_settings_assistants ausente' where to_regclass('public.myia_settings_assistants') is null;
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/0002_assistants.test.sql`
Expected: FAIL — imprime linhas de "ausente".

- [ ] **Step 3: Escrever a migration**

Create `supabase/migrations/0002_assistants.sql`:
```sql
create table if not exists myia_assistants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,
  name text not null,
  paused boolean not null default false,
  purpose text,
  description text,
  avatar text,
  llm text,
  objective text,
  identity text,
  greetings text,
  strategy text,
  behavior text,
  behavior_text text,
  fallbacks text,
  avoided_topics text,
  step_by_step text,
  goodbye text,
  roles text,
  tel_fallback text,
  created_at timestamptz not null default now()
);
create index if not exists idx_assistants_company on myia_assistants(company_id);

-- Catálogo global de LLMs (sem company_id; leitura pública autenticada)
create table if not exists myia_assistants_llms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  enabled boolean not null default true,
  icon text
);

create table if not exists myia_settings_assistants (
  id uuid primary key default gen_random_uuid(),
  assistant_id uuid not null references myia_assistants(id) on delete cascade,
  instance_conection text,
  used_tokens bigint not null default 0,
  available_tokens bigint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_settings_assistant on myia_settings_assistants(assistant_id);

create table if not exists myia_channels (
  id uuid primary key default gen_random_uuid(),
  assistant_id uuid not null references myia_assistants(id) on delete cascade,
  nome text,
  "tipoConexao" text,
  titular text,
  "ultimaAtualizacao" timestamptz,
  "numeroTel" text,
  "fotoPerfil" text,
  token text,
  urlapi text,
  "apiUtilizada" text,
  status text not null default 'created',
  qrcode64 text,
  pairing_code text,
  looping_qrcode integer default 0,
  "instanceWpp" text,
  "remoteJid" text,
  created_at timestamptz not null default now()
);
create index if not exists idx_channels_assistant on myia_channels(assistant_id);
```
> Nota: nomes de coluna camelCase vêm dos interfaces existentes (`Channel`), por isso as aspas duplas — não renomear para evitar quebrar o painel.

- [ ] **Step 4: Aplicar e ver passar**

Run: `supabase db reset && psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/0002_assistants.test.sql`
Expected: PASS — zero linhas.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002_assistants.sql supabase/tests/0002_assistants.test.sql
git commit -m "feat(db): assistants domain (assistants, llms, settings, channels)"
```

---

### Task 3: Domínio Mensageria (contacts, chat, messages)

**Files:**
- Create: `supabase/migrations/0003_messaging.sql`
- Create: `supabase/tests/0003_messaging.test.sql`

**Interfaces:**
- Consumes: `myia_companies` (Task 1).
- Produces: `myia_contacts`, `myia_chat`, `myia_messages`. Colunas de `myia_messages` conforme os payloads de insert em `src/services/MessageService.ts` (`from_me`, `message_id`, `key` jsonb, `message_type`, `message` jsonb, `message_timestamp` bigint, `instance_id`, `chat_id`, `status`).

- [ ] **Step 1: Escrever o teste que falha**

Create `supabase/tests/0003_messaging.test.sql`:
```sql
select 'myia_contacts ausente' where to_regclass('public.myia_contacts') is null;
select 'myia_chat ausente'     where to_regclass('public.myia_chat') is null;
select 'myia_messages ausente' where to_regclass('public.myia_messages') is null;
select 'coluna message_id ausente' where not exists (
  select 1 from information_schema.columns
  where table_name='myia_messages' and column_name='message_id');
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/0003_messaging.test.sql`
Expected: FAIL.

- [ ] **Step 3: Escrever a migration**

Create `supabase/migrations/0003_messaging.sql`:
```sql
create table if not exists myia_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,
  name text not null,
  avatar_url text,
  remote_jid text,
  number text,
  checked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_contacts_company on myia_contacts(company_id);

create table if not exists myia_chat (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,
  contact_id uuid references myia_contacts(id) on delete set null,
  channel_name text,
  instance_id text,
  labels text[],
  muted boolean not null default false,
  archived boolean not null default false,
  bot_running boolean not null default false,
  chat_pause boolean not null default false,
  last_message jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists idx_chat_company on myia_chat(company_id);
create index if not exists idx_chat_contact on myia_chat(contact_id);

create table if not exists myia_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references myia_chat(id) on delete cascade,
  from_me boolean not null default false,
  message_id text,
  key jsonb,
  message_type text,
  message jsonb,
  message_timestamp bigint,
  instance_id text,
  status text not null default 'PENDING',
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_chat on myia_messages(chat_id);
create index if not exists idx_messages_message_id on myia_messages(message_id);
```

- [ ] **Step 4: Aplicar e ver passar**

Run: `supabase db reset && psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/0003_messaging.test.sql`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0003_messaging.sql supabase/tests/0003_messaging.test.sql
git commit -m "feat(db): messaging domain (contacts, chat, messages)"
```

---

### Task 4: Domínio Catálogo (categories, products, services)

**Files:**
- Create: `supabase/migrations/0004_catalog.sql`
- Create: `supabase/tests/0004_catalog.test.sql`

**Interfaces:**
- Consumes: `myia_companies` (Task 1).
- Produces: `myia_categories`, `myia_products`, `myia_services`. `valores_convenios` é `jsonb` (array de `{convenio, valor, enable}` — ver `Services/interfaces.ts`).

- [ ] **Step 1: Escrever o teste que falha**

Create `supabase/tests/0004_catalog.test.sql`:
```sql
select 'myia_categories ausente' where to_regclass('public.myia_categories') is null;
select 'myia_products ausente'   where to_regclass('public.myia_products') is null;
select 'myia_services ausente'   where to_regclass('public.myia_services') is null;
select 'coluna valores_convenios ausente' where not exists (
  select 1 from information_schema.columns
  where table_name='myia_services' and column_name='valores_convenios');
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/0004_catalog.test.sql`
Expected: FAIL.

- [ ] **Step 3: Escrever a migration**

Create `supabase/migrations/0004_catalog.sql`:
```sql
create table if not exists myia_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,
  name text not null
);
create index if not exists idx_categories_company on myia_categories(company_id);

create table if not exists myia_products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,
  category_id uuid references myia_categories(id) on delete set null,
  name text not null,
  price numeric(10,2) not null default 0,
  description text,
  available boolean not null default true,
  image_path text,
  created_at timestamptz not null default now()
);
create index if not exists idx_products_company on myia_products(company_id);

create table if not exists myia_services (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null default 0,
  description text,
  tempo_medio text,
  available boolean not null default true,
  image_path text,
  aceita_convenio boolean not null default false,
  valores_convenios jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_services_company on myia_services(company_id);
```

- [ ] **Step 4: Aplicar e ver passar**

Run: `supabase db reset && psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/0004_catalog.test.sql`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0004_catalog.sql supabase/tests/0004_catalog.test.sql
git commit -m "feat(db): catalog domain (categories, products, services)"
```

---

### Task 5: Domínio Config da Empresa (addresses, agreements, payment_methods, policies, specialties)

**Files:**
- Create: `supabase/migrations/0005_company_config.sql`
- Create: `supabase/tests/0005_company_config.test.sql`

**Interfaces:**
- Consumes: `myia_companies` (Task 1).
- Produces: `myia_company_addresses`, `myia_company_agreements`, `myia_company_payment_methods`, `myia_company_policies`, `myia_specialties`.
> Nota: `myia_company_policies` não tem interface TS detalhado no repo; modelamos `name`/`description`/`status` seguindo o padrão de agreements. Ajustar na Task 9 se o painel exigir outra coluna.

- [ ] **Step 1: Escrever o teste que falha**

Create `supabase/tests/0005_company_config.test.sql`:
```sql
select 'myia_company_addresses ausente'       where to_regclass('public.myia_company_addresses') is null;
select 'myia_company_agreements ausente'      where to_regclass('public.myia_company_agreements') is null;
select 'myia_company_payment_methods ausente' where to_regclass('public.myia_company_payment_methods') is null;
select 'myia_company_policies ausente'        where to_regclass('public.myia_company_policies') is null;
select 'myia_specialties ausente'             where to_regclass('public.myia_specialties') is null;
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/0005_company_config.test.sql`
Expected: FAIL.

- [ ] **Step 3: Escrever a migration**

Create `supabase/migrations/0005_company_config.sql`:
```sql
create table if not exists myia_company_addresses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,
  zip_code text,
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state_code text,
  state text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);
create index if not exists idx_addresses_company on myia_company_addresses(company_id);

create table if not exists myia_company_agreements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,
  name text not null,
  status boolean not null default true,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_agreements_company on myia_company_agreements(company_id);

create table if not exists myia_company_payment_methods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,
  name text not null,
  status boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_payment_methods_company on myia_company_payment_methods(company_id);

create table if not exists myia_company_policies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,
  name text not null,
  description text,
  status boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_policies_company on myia_company_policies(company_id);

create table if not exists myia_specialties (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);
create index if not exists idx_specialties_company on myia_specialties(company_id);
```

- [ ] **Step 4: Aplicar e ver passar**

Run: `supabase db reset && psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/0005_company_config.test.sql`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_company_config.sql supabase/tests/0005_company_config.test.sql
git commit -m "feat(db): company config domain (addresses, agreements, payments, policies, specialties)"
```

---

### Task 6: Domínio Agendamento (professionals_medical, professional_services, availability, appointments)

**Files:**
- Create: `supabase/migrations/0006_scheduling.sql`
- Create: `supabase/tests/0006_scheduling.test.sql`

**Interfaces:**
- Consumes: `myia_companies` (Task 1), `myia_services` (Task 4), `myia_contacts` (Task 3).
- Produces: `myia_professionals_medical`, `myia_professional_services`, `myia_professional_availability`, `myia_appointments`. Colunas conforme `Professionals/interfaces.ts` e `Appointments/interfaces.ts` (`horarios_atendimento` jsonb; `atende_cat_idade`/`convenios_aceitos`/`search_tags` text[]).

- [ ] **Step 1: Escrever o teste que falha**

Create `supabase/tests/0006_scheduling.test.sql`:
```sql
select 'myia_professionals_medical ausente'    where to_regclass('public.myia_professionals_medical') is null;
select 'myia_professional_services ausente'    where to_regclass('public.myia_professional_services') is null;
select 'myia_professional_availability ausente' where to_regclass('public.myia_professional_availability') is null;
select 'myia_appointments ausente'             where to_regclass('public.myia_appointments') is null;
select 'coluna horarios_atendimento ausente' where not exists (
  select 1 from information_schema.columns
  where table_name='myia_professionals_medical' and column_name='horarios_atendimento');
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/0006_scheduling.test.sql`
Expected: FAIL.

- [ ] **Step 3: Escrever a migration**

Create `supabase/migrations/0006_scheduling.sql`:
```sql
create table if not exists myia_professionals_medical (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,
  nome text not null,
  formacao text,
  especialidade text,
  registro text,
  atende_cat_idade text[],
  convenios_aceitos text[],
  horarios_atendimento jsonb,
  email text,
  telefone text,
  observacoes text,
  search_tags text[],
  notificame_dia boolean default false,
  notificame_horas boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_professionals_company on myia_professionals_medical(company_id);

create table if not exists myia_professional_services (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references myia_professionals_medical(id) on delete cascade,
  service_id uuid not null references myia_services(id) on delete cascade,
  mode text,            -- INDIVIDUAL | GRUPO | AMBOS
  max_people integer,
  price numeric(10,2),
  created_at timestamptz not null default now(),
  unique (professional_id, service_id)
);
create index if not exists idx_prof_services_prof on myia_professional_services(professional_id);

create table if not exists myia_professional_availability (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references myia_professionals_medical(id) on delete cascade,
  service_id uuid not null references myia_services(id) on delete cascade,
  weekday integer not null,  -- 1=Segunda ... 7=Domingo
  start_time time not null,
  end_time time not null,
  max_simultaneous_clients integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (professional_id, service_id, weekday, start_time)
);
create index if not exists idx_availability_prof on myia_professional_availability(professional_id);

create table if not exists myia_appointments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references myia_companies(id) on delete cascade,
  professional_id uuid not null references myia_professionals_medical(id) on delete cascade,
  service_id uuid not null references myia_services(id) on delete cascade,
  client_id uuid references myia_contacts(id) on delete set null,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'scheduled', -- scheduled|completed|cancelled|no_show|rescheduled
  notes text,
  location text,
  appointment_type text,  -- individual|group
  convenio_usado text,
  valor_cobrado numeric(10,2),
  cliente_nome text,
  cliente_telefone text,
  cliente_email text,
  pesquisa text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_appointments_company on myia_appointments(company_id);
create index if not exists idx_appointments_date on myia_appointments(appointment_date);
```

- [ ] **Step 4: Aplicar e ver passar**

Run: `supabase db reset && psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/0006_scheduling.test.sql`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0006_scheduling.sql supabase/tests/0006_scheduling.test.sql
git commit -m "feat(db): scheduling domain (professionals, services link, availability, appointments)"
```

---

### Task 7: RLS multi-tenant em todas as tabelas de tenant

**Files:**
- Create: `supabase/migrations/0007_rls.sql`
- Create: `supabase/tests/0007_rls.test.sql`

**Interfaces:**
- Consumes: `auth_company_id()` (Task 1) e todas as tabelas das Tasks 2–6.
- Produces: RLS habilitado + policies `select/insert/update/delete` por `company_id = auth_company_id()` em cada tabela de tenant. `myia_channels`, `myia_settings_assistants`, `myia_messages`, `myia_professional_services`, `myia_professional_availability` isolam via join ao pai (não têm `company_id` direto).

- [ ] **Step 1: Escrever o teste que falha**

Create `supabase/tests/0007_rls.test.sql`:
```sql
-- Toda tabela de tenant deve ter rowsecurity = true
select tablename || ' sem RLS' from pg_tables
where schemaname='public' and tablename in (
  'myia_assistants','myia_contacts','myia_chat','myia_messages','myia_categories',
  'myia_products','myia_services','myia_company_addresses','myia_company_agreements',
  'myia_company_payment_methods','myia_company_policies','myia_specialties',
  'myia_professionals_medical','myia_professional_services','myia_professional_availability',
  'myia_appointments','myia_channels','myia_settings_assistants')
and rowsecurity = false;
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/0007_rls.test.sql`
Expected: FAIL — lista tabelas sem RLS.

- [ ] **Step 3: Escrever a migration**

Create `supabase/migrations/0007_rls.sql`:
```sql
-- Helper: policy padrão por company_id direto
do $$
declare t text;
begin
  foreach t in array array[
    'myia_assistants','myia_contacts','myia_chat','myia_categories','myia_products',
    'myia_services','myia_company_addresses','myia_company_agreements',
    'myia_company_payment_methods','myia_company_policies','myia_specialties',
    'myia_professionals_medical','myia_appointments'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format($f$create policy %1$s_tenant_all on %1$s
      for all using (company_id = auth_company_id())
      with check (company_id = auth_company_id());$f$, t);
  end loop;
end $$;

-- LLMs: catálogo global, leitura para qualquer autenticado
alter table myia_assistants_llms enable row level security;
create policy llms_read on myia_assistants_llms for select using (auth.role() = 'authenticated');

-- Tabelas-filhas isolam via join ao pai
alter table myia_channels enable row level security;
create policy channels_tenant on myia_channels for all
  using (exists (select 1 from myia_assistants a where a.id = assistant_id and a.company_id = auth_company_id()))
  with check (exists (select 1 from myia_assistants a where a.id = assistant_id and a.company_id = auth_company_id()));

alter table myia_settings_assistants enable row level security;
create policy settings_tenant on myia_settings_assistants for all
  using (exists (select 1 from myia_assistants a where a.id = assistant_id and a.company_id = auth_company_id()))
  with check (exists (select 1 from myia_assistants a where a.id = assistant_id and a.company_id = auth_company_id()));

alter table myia_messages enable row level security;
create policy messages_tenant on myia_messages for all
  using (exists (select 1 from myia_chat c where c.id = chat_id and c.company_id = auth_company_id()))
  with check (exists (select 1 from myia_chat c where c.id = chat_id and c.company_id = auth_company_id()));

alter table myia_professional_services enable row level security;
create policy prof_services_tenant on myia_professional_services for all
  using (exists (select 1 from myia_professionals_medical p where p.id = professional_id and p.company_id = auth_company_id()))
  with check (exists (select 1 from myia_professionals_medical p where p.id = professional_id and p.company_id = auth_company_id()));

alter table myia_professional_availability enable row level security;
create policy availability_tenant on myia_professional_availability for all
  using (exists (select 1 from myia_professionals_medical p where p.id = professional_id and p.company_id = auth_company_id()))
  with check (exists (select 1 from myia_professionals_medical p where p.id = professional_id and p.company_id = auth_company_id()));
```

- [ ] **Step 4: Aplicar e ver passar**

Run: `supabase db reset && psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/0007_rls.test.sql`
Expected: PASS — zero linhas.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0007_rls.sql supabase/tests/0007_rls.test.sql
git commit -m "feat(db): multi-tenant RLS policies on all tenant tables"
```

---

### Task 8: Seed de desenvolvimento + teste de isolamento RLS

**Files:**
- Create: `supabase/seed.sql`
- Create: `supabase/tests/0008_isolation.test.sql`

**Interfaces:**
- Consumes: todas as tabelas + `auth_company_id()`.
- Produces: 2 empresas, 2 usuários (um por empresa), 1 assistente + 1 serviço por empresa. Teste prova que o usuário A não enxerga dados da empresa B.

- [ ] **Step 1: Escrever o teste que falha**

Create `supabase/tests/0008_isolation.test.sql`:
```sql
-- Simula o usuário A e garante que só vê a empresa dele
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id::text from myia_users order by created_at limit 1),
                    'role','authenticated')::text, true);
select 'vazamento entre tenants' from myia_assistants
where company_id <> auth_company_id();
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/0008_isolation.test.sql`
Expected: FAIL — sem seed, o `set_config` falha ou não há usuários; corrigido pelo seed no passo seguinte.

- [ ] **Step 3: Escrever o seed**

Create `supabase/seed.sql`:
```sql
-- Empresa A + usuário A
insert into auth.users (id, email, encrypted_password, email_confirmed_at, aud, role)
values ('11111111-1111-1111-1111-111111111111','clinica.a@teste.dev',
        crypt('senha123', gen_salt('bf')), now(), 'authenticated','authenticated')
on conflict (id) do nothing;
insert into myia_companies (id, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Clínica A') on conflict do nothing;
insert into myia_users (id, company_id, role) values
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','owner')
  on conflict do nothing;
insert into myia_assistants (company_id, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Julia (A)') on conflict do nothing;
insert into myia_services (company_id, name, price) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Consulta', 200) on conflict do nothing;

-- Empresa B + usuário B
insert into auth.users (id, email, encrypted_password, email_confirmed_at, aud, role)
values ('22222222-2222-2222-2222-222222222222','clinica.b@teste.dev',
        crypt('senha123', gen_salt('bf')), now(), 'authenticated','authenticated')
on conflict (id) do nothing;
insert into myia_companies (id, name) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Clínica B') on conflict do nothing;
insert into myia_users (id, company_id, role) values
  ('22222222-2222-2222-2222-222222222222','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','owner')
  on conflict do nothing;
insert into myia_assistants (company_id, name) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Bot (B)') on conflict do nothing;
```

- [ ] **Step 4: Aplicar e ver passar**

Run: `supabase db reset && psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/0008_isolation.test.sql`
Expected: PASS — zero linhas de vazamento (`db reset` roda o `seed.sql` automaticamente).

- [ ] **Step 5: Commit**

```bash
git add supabase/seed.sql supabase/tests/0008_isolation.test.sql
git commit -m "feat(db): dev seed + RLS tenant-isolation test"
```

---

### Task 9: Projeto na nuvem + religar painel + smoke test

**Files:**
- Create: `.env.local` (não versionado — preencher com as chaves do projeto novo)
- Create: `src/database/types.ts` (types gerados; resolve o import pendurado `@/database/types`)
- Modify: `src/contexts/Auth/index.tsx` (ler `company_id` de `myia_users` após login, se ainda não fizer)

**Interfaces:**
- Consumes: todas as migrations (Tasks 1–8).
- Produces: painel Next.js autenticando e lendo/gravando contra o Supabase novo.

- [ ] **Step 1: Criar o projeto na nuvem e linkar**

Run:
```bash
supabase projects create myia-app --org-id <ORG_ID> --region sa-east-1   # ou via dashboard
supabase link --project-ref <PROJECT_REF>
```
Expected: projeto criado; `supabase link` grava o ref em `supabase/config.toml`.

- [ ] **Step 2: Empurrar o schema pra nuvem**

Run: `supabase db push`
Expected: PASS — aplica migrations 0001–0007 no projeto remoto sem erro.

- [ ] **Step 3: Gerar os types e resolver o import pendurado**

Run: `supabase gen types typescript --linked > src/database/types.ts`
Expected: cria `src/database/types.ts` exportando `Database` — resolve o import de `Appointments/interfaces.ts`.

- [ ] **Step 4: Preencher `.env.local` com as chaves do projeto novo**

Preencher (valores do dashboard → Project Settings → API), usando `.env.example` como referência:
```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>
SUPABASE_SERVICE_ROLE_KEY=<service_role>
NEXT_PUBLIC_SUPABASE_STORAGE_URL=https://<ref>.supabase.co/storage/v1
```

- [ ] **Step 5: Ajustar o Auth para resolver company_id**

Em `src/contexts/Auth/index.tsx`, após obter a sessão, buscar o `company_id`:
```ts
const { data: profile } = await supabase
  .from("myia_users")
  .select("company_id, role")
  .eq("id", session.user.id)
  .single()
// disponibilizar profile.company_id no contexto para os demais providers
```
> Se o Auth já resolve tenancy de outra forma, adaptar sem quebrar a assinatura pública do contexto.

- [ ] **Step 6: Criar um usuário de teste na nuvem e fazer login no painel**

Run:
```bash
supabase db reset --linked   # OPCIONAL: só se quiser o seed na nuvem também
npm run dev
```
Then: abrir `http://localhost:3000/login`, autenticar com o usuário semeado (`clinica.a@teste.dev` / `senha123`) ou um criado no dashboard (lembrar de inserir a linha correspondente em `myia_users`).
Expected: login OK; dashboard carrega sem erros de "relation does not exist" no console.

- [ ] **Step 7: Smoke test de CRUD pelo painel**

Manualmente no painel: criar um **Serviço**, criar um **Assistente**, criar um **Contato**. Recarregar e confirmar que persistem.
Expected: cada item aparece após reload; nenhum erro 401/403 (RLS) nem 400 (coluna faltando) no console/network. Anotar qualquer coluna divergente e corrigir na migration correspondente + `supabase db push`.

- [ ] **Step 8: Commit**

```bash
git add src/database/types.ts src/contexts/Auth/index.tsx
git commit -m "feat: rewire panel to new Supabase (types, auth tenancy)"
```

---

## Self-Review

**Spec coverage (vs. `2026-07-15-foundation-relaunch-design.md` §5):**
- Criar projeto Supabase nosso → Task 9. ✅
- Migrar/aplicar schema completo (`myia_*`) → Tasks 1–6. ✅
- RLS → Task 7. ✅
- Trocar env vars → Task 9 Step 4. ✅
- Smoke test do painel → Task 9 Steps 6–7. ✅
- Storage (MinIO vs Supabase Storage): **fora deste plano** — o storage atual (MinIO) continua apontado pelas envs `MINIO_*`; migração de storage é decisão anotada em §10 da spec e não bloqueia o painel voltar. Tratar em plano próprio se necessário.
- Migração de DADOS: **não se aplica** — decidido "começar limpo".

**Placeholder scan:** sem TBD/TODO. Duas notas de incerteza explícitas e delimitadas: `myia_company_policies` (colunas modeladas por analogia) e `myia_professional_services` (campos derivados de `ServiceMetadata`) — ambas com instrução de ajuste no smoke test (Task 9 Step 7).

**Type consistency:** `auth_company_id()` definida na Task 1 e usada nas Tasks 7–8 com o mesmo nome. Nomes de tabela batem com `src/contexts/supa_tables.ts`. Colunas camelCase de `myia_channels` mantidas entre aspas conforme o interface `Channel`.

**Dependência externa:** Task 9 exige uma conta/organização Supabase (ação do Vitor) — passo manual sinalizado, não bloqueia Tasks 0–8 (100% locais).
