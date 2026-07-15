-- Falha se a função de tenancy não existir
select 'auth_company_id ausente' where not exists (
  select 1 from pg_proc where proname = 'auth_company_id'
);
-- Falha se as tabelas não existirem
select 'myia_companies ausente' where to_regclass('public.myia_companies') is null;
select 'myia_users ausente'     where to_regclass('public.myia_users') is null;
