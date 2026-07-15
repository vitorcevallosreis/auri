-- Seed de desenvolvimento — 2 empresas isoladas.
-- Idempotente (on conflict do nothing). Aplicar com: node scripts/db-apply.mjs supabase/seed.sql
-- IDs fixos para que o teste de isolamento (0009) possa referenciá-los.
-- ATENÇÃO: estes usuários (auth.users inseridos via SQL) são APENAS para o teste de
-- isolamento SQL — NÃO logam via GoTrue (falta auth.identities). Os usuários de LOGIN
-- do painel são criados via Admin API em scripts/seed-auth.mjs, com emails clinica.*.

-- ===== Empresa A =====
insert into auth.users (id, email, encrypted_password, email_confirmed_at, aud, role, instance_id)
values ('11111111-1111-1111-1111-111111111111', 'iso-a@internal.test',
        crypt('senha123', gen_salt('bf')), now(), 'authenticated', 'authenticated',
        '00000000-0000-0000-0000-000000000000')
on conflict (id) do nothing;

insert into myia_companies (id, name)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Clínica A')
on conflict (id) do nothing;

insert into myia_users (id, company_id, role)
values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner')
on conflict (id) do nothing;

insert into myia_assistants (id, company_id, name)
values ('aa510000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Julia (A)')
on conflict (id) do nothing;

insert into myia_services (id, company_id, name, price)
values ('a5e40000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Consulta', 200)
on conflict (id) do nothing;

-- ===== Empresa B =====
insert into auth.users (id, email, encrypted_password, email_confirmed_at, aud, role, instance_id)
values ('22222222-2222-2222-2222-222222222222', 'iso-b@internal.test',
        crypt('senha123', gen_salt('bf')), now(), 'authenticated', 'authenticated',
        '00000000-0000-0000-0000-000000000000')
on conflict (id) do nothing;

insert into myia_companies (id, name)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Clínica B')
on conflict (id) do nothing;

insert into myia_users (id, company_id, role)
values ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner')
on conflict (id) do nothing;

insert into myia_assistants (id, company_id, name)
values ('bb510000-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Bot (B)')
on conflict (id) do nothing;
