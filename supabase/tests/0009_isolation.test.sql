-- Prova de isolamento multi-tenant (RLS). Impersona o usuário A (Clínica A) e
-- garante que ele NÃO enxerga dados da Clínica B. Rodar com o db-test.mjs, que
-- executa tudo em UMA transação (rollback) na mesma conexão, então `set local
-- role` e os claims de JWT persistem entre os statements.
-- PASS = zero linhas retornadas. Requer o seed aplicado (scripts/db-apply.mjs supabase/seed.sql).

-- Seta os claims do JWT e o role via comando SET (não emite linhas, ao contrário
-- de set_config()). set local => escopo da transação (rollback pelo runner).
set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
set local role authenticated;

-- (1) A impersonação resolveu para a empresa A? (pega o caso auth_company_id() = NULL)
select 'auth_company_id incorreto: ' || coalesce(auth_company_id()::text, 'NULL')
where auth_company_id() is distinct from 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;

-- (2) Nenhum assistente visível pode pertencer a outra empresa
select 'vazamento generico: ' || company_id from myia_assistants
where company_id is distinct from auth_company_id();

-- (3) O assistente específico da empresa B não pode estar visível para A
select 'vazou assistant de B' from myia_assistants
where id = 'bb510000-0000-4000-8000-000000000002'::uuid;
