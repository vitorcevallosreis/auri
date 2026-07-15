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
