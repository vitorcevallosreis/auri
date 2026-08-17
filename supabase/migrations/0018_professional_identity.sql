-- Identidade do profissional: dar login ao médico.
--
-- Até aqui `myia_professionals_medical` era catálogo puro — nome, especialidade,
-- registro — sem nenhum vínculo com `auth.users`. O médico não tinha como entrar
-- no sistema. Esta migration cria esse vínculo e o vocabulário de papel que as
-- policies de 0019 vão usar.
--
-- O vínculo vive em `myia_users.professional_id`, e não em
-- `myia_professionals_medical.user_id`, por um motivo estrutural: `myia_users.id`
-- É o `auth.users.id` e é PK, então uma coluna aqui já garante "um login → no
-- máximo um profissional" sem índice extra. Na direção oposta, nada impediria
-- duas linhas de empresas diferentes apontando para o mesmo auth user, e
-- `auth_professional_id()` — que é escalar — devolveria uma delas arbitrariamente.
--
-- Um profissional PODE existir sem login: `professional_id` é opcional do lado
-- do usuário, e o catálogo não ganha coluna nenhuma.

-- ---------------------------------------------------------------- pré-condição
-- `role` é texto livre desde 0001 e só 'owner' foi gravado (signup/route.ts e
-- seed-auth.mjs). Se houver qualquer outro valor, aborta: reescrever papel em
-- silêncio apagaria uma decisão que alguém tomou à mão.
do $$
declare n int;
begin
  select count(*) into n from myia_users where role not in ('owner', 'professional');
  if n > 0 then
    raise exception
      'myia_users: % linha(s) com role fora de (owner, professional). Inspecione e corrija À MÃO antes de aplicar — esta migration não reescreve papel.', n;
  end if;
end $$;

-- ------------------------------------------------------------------- identidade
-- Alvo da FK composta abaixo. O par (id, company_id) é redundante com a PK, mas
-- o Postgres exige um único sobre exatamente as colunas referenciadas.
alter table myia_professionals_medical
  drop constraint if exists myia_professionals_medical_id_company_uk;
alter table myia_professionals_medical
  add constraint myia_professionals_medical_id_company_uk unique (id, company_id);

alter table myia_users add column if not exists professional_id uuid;

-- FK COMPOSTA, não simples: o profissional referenciado tem de ser da MESMA
-- empresa do usuário. Sem isso, um insert com service role poderia dar a um
-- médico da clínica A o professional_id de um médico da clínica B — e todas as
-- policies de 0019, que confiam nessa coerência, vazariam entre tenants.
--
-- ON DELETE CASCADE: apagar o médico do catálogo revoga o login dele. Além de
-- ser a semântica certa, é o que mantém scripts/seed-dashboard-demo.mjs
-- funcionando — ele apaga e recria os profissionais de demonstração, e sob
-- NO ACTION esse delete abortaria com violação de FK.
alter table myia_users drop constraint if exists myia_users_professional_fk;
alter table myia_users
  add constraint myia_users_professional_fk
  foreign key (professional_id, company_id)
  references myia_professionals_medical (id, company_id)
  on delete cascade;

-- Papel e escopo andam juntos: owner nunca tem professional_id, profissional
-- sempre tem. Escrito como equivalência para pegar os dois erros de uma vez.
alter table myia_users drop constraint if exists myia_users_role_scope_ck;
alter table myia_users
  add constraint myia_users_role_scope_ck
  check ((role = 'professional') = (professional_id is not null));

alter table myia_users drop constraint if exists myia_users_role_ck;
alter table myia_users
  add constraint myia_users_role_ck check (role in ('owner', 'professional'));

-- --------------------------------------------------------------------- funções
-- ATENÇÃO À COLISÃO DE NOMES. `auth.role()` (com PONTO) é built-in do Supabase e
-- devolve a role do JWT ('anon' | 'authenticated'); ela já é usada em
-- 0007_rls.sql:20. A função abaixo, `app_role()`, devolve o papel de APLICAÇÃO
-- ('owner' | 'professional'). Trocar uma pela outra COMPILA e é sempre falso,
-- deixando a tabela inteira invisível sem erro nenhum. Daí o nome com prefixo
-- diferente, em vez do `auth_role()` que seria o espelho óbvio de
-- `auth_company_id()`.
create or replace function app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from myia_users where id = auth.uid();
$$;

create or replace function auth_professional_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select professional_id from myia_users where id = auth.uid();
$$;

-- `security definer` não é enfeite: as duas leem myia_users, que tem RLS, e são
-- chamadas de dentro das policies da própria myia_users. Rodando como dona da
-- tabela, o RLS é ignorado lá dentro e não há recursão — mesma razão pela qual
-- auth_company_id() já é definer desde 0001.
--
-- COROLÁRIO: nunca aplicar `alter table myia_users force row level security`.
-- Isso anularia a saída acima e derrubaria o login inteiro com
-- "infinite recursion detected in policy for relation myia_users".
--
-- Ambas devolvem NULL para quem não tem linha em myia_users. Todo predicado de
-- 0019 compara com igualdade, e NULL reprova — o esquema fecha por padrão.

grant execute on function app_role()             to anon, authenticated, service_role;
grant execute on function auth_professional_id() to anon, authenticated, service_role;

-- --------------------------------------------------------------------- índices
-- A policy de myia_contacts em 0019 faz um EXISTS por linha de contato contra a
-- tabela de agendamentos (~1,8k linhas por empresa na base de demonstração).
-- Hoje só existem idx_appointments_company e idx_appointments_date.
create index if not exists idx_appointments_professional_date
  on myia_appointments(professional_id, appointment_date);
create index if not exists idx_appointments_professional_client
  on myia_appointments(professional_id, client_id);
create index if not exists idx_myia_users_professional
  on myia_users(professional_id) where professional_id is not null;
