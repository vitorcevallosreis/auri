-- Garante que todas as tabelas usadas por subscribeToTable/.channel(...postgres_changes)
-- no front-end (src/contexts/**) estão na publicação supabase_realtime.
-- PASS = zero linhas retornadas.

select 'faltando no realtime: ' || t from unnest(array[
  'myia_messages',
  'myia_channels',
  'myia_contacts',
  'myia_chat',
  'myia_company_policies',
  'myia_company_payment_methods'
]) as t
where not exists (
  select 1 from pg_publication_tables
  where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = t
);
