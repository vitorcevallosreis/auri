-- Torna explicito o acesso das roles da API às tabelas do schema public.
-- O Supabase historicamente expõe automaticamente tabelas novas às roles
-- anon/authenticated/service_role; isso é um comportamento legado e não
-- deve ser a única fonte de verdade. RLS continua controlando o acesso por
-- linha; estes GRANTs são apenas no nível de tabela/coluna.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;

grant usage, select on all sequences in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;

alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;
