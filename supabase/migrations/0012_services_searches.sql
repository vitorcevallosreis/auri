-- myia_services_searches — registro de buscas de serviço (analytics do dashboard).
--
-- Por que agora: a tabela existia no schema antigo e ficou de fora da reconstrução
-- do Plano 1 (migrations 0001-0010), mas dois hooks continuaram consultando-a
-- (src/hooks/useTopSearchedServices.ts e src/hooks/useServiceSearches.ts). Sem
-- ela o dashboard abre com "Could not find the table 'public.myia_services_searches'".
--
-- Colunas derivadas do uso real nos hooks: filtro por company_id, join com
-- myia_services (service_id) e ordenação por created_at.

create table if not exists myia_services_searches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,
  service_id uuid not null references myia_services(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Os hooks ordenam por created_at e filtram por company_id.
create index if not exists idx_myia_services_searches_company_created
  on myia_services_searches(company_id, created_at desc);
create index if not exists idx_myia_services_searches_service
  on myia_services_searches(service_id);

-- Mesmo padrão multi-tenant das demais tabelas (migration 0007): a linha só é
-- visível/gravável pela empresa dona.
alter table myia_services_searches enable row level security;

-- `create policy` não aceita IF NOT EXISTS, e esta migration foi aplicada uma
-- vez à mão pelo SQL editor sem ficar registrada em supabase_migrations — o
-- push seguinte tentaria recriar a policy e abortaria. O drop antes torna a
-- migration reexecutável.
drop policy if exists myia_services_searches_tenant_all on myia_services_searches;

create policy myia_services_searches_tenant_all on myia_services_searches
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

-- 0009 já dá os grants por default privileges, mas ser explícito não custa e
-- protege caso a tabela seja recriada fora daquele fluxo.
grant select, insert, update, delete on myia_services_searches
  to anon, authenticated, service_role;
