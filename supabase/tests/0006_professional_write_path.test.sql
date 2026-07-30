-- Caminho de escrita do cadastro de profissional.
--
-- Reproduz exatamente o payload que o painel grava em
-- src/contexts/Professionals/index.tsx (createProfessional + saveProfessionalCatalog).
-- Existe porque o cadastro passou meses postando para um webhook de terceiro que
-- morreu: a tela dizia nada e o banco ficava vazio. Se uma coluna sumir ou mudar
-- de tipo, a quebra aparece aqui, e não em silencio na cara do usuario.
--
-- Convencao do runner: qualquer linha retornada e uma falha de assercao.

create temporary table t_ids on commit drop as
select
  (select id from myia_companies order by created_at limit 1) as company_id,
  (select id from myia_services  order by created_at limit 1) as service_id;

select 'sem company/service no banco para exercitar o cadastro'
  where exists (select 1 from t_ids where company_id is null or service_id is null);

create temporary table t_prof (id uuid) on commit drop;

-- 1. O profissional em si.
with novo as (
  insert into myia_professionals_medical (
    company_id, nome, formacao, registro, email, telefone,
    especialidade, search_tags, atende_cat_idade, convenios_aceitos,
    horarios_atendimento, observacoes
  )
  select
    company_id, 'Profissional Write Path', 'Fisioterapia', 'CREFITO-000',
    'write.path@exemplo.test', '11999990000',
    'Ortopedia', array['Ortopedia'], array['ADULTO'], array['Unimed'],
    '{"monday":{"enabled":true,"opening":"08:00","closing":"12:00"}}'::jsonb,
    null
  from t_ids
  returning id
)
insert into t_prof (id) select id from novo;

-- 2. Servicos atendidos.
insert into myia_professional_services (professional_id, service_id, mode, price)
select p.id, i.service_id, 'INDIVIDUAL', 150 from t_prof p, t_ids i;

-- 3. Agenda semanal — uma linha por (servico, dia habilitado).
insert into myia_professional_availability (
  professional_id, service_id, weekday, start_time, end_time, max_simultaneous_clients
)
select p.id, i.service_id, 1, '08:00', '12:00', 1 from t_prof p, t_ids i;

-- O agente le convenios_aceitos como text[] e entrega o conteudo ao paciente.
-- Se voltar a ser gravado como mapa JSON (o formato do codigo antigo), quebra.
select 'convenios_aceitos nao guardou o NOME do convenio'
  where not exists (
    select 1 from myia_professionals_medical m
    join t_prof p on p.id = m.id
    where 'Unimed' = any(m.convenios_aceitos));

select 'atende_cat_idade nao guardou a faixa etaria'
  where not exists (
    select 1 from myia_professionals_medical m
    join t_prof p on p.id = m.id
    where 'ADULTO' = any(m.atende_cat_idade));

-- Este e o join que consultar_disponibilidade faz em worker/tools.mts. Se ele
-- nao achar nada, o agente responde "nao tenho horario" para sempre.
select 'disponibilidade invisivel para o join do agente (servico, weekday)'
  where not exists (
    select 1 from myia_professional_availability a
    join t_prof p on p.id = a.professional_id
    join t_ids i on i.service_id = a.service_id
    where a.weekday = 1
      and a.start_time = time '08:00'
      and a.end_time   = time '12:00');

-- weekday 1 = Segunda, mesma convencao de isoWeekday() no worker. Um mapa
-- deslocado ofereceria horario no dia errado sem erro nenhum.
select 'weekday fora do intervalo 1..7'
  where exists (
    select 1 from myia_professional_availability a
    join t_prof p on p.id = a.professional_id
    where a.weekday < 1 or a.weekday > 7);

-- O formulario tambem roda sobre profissional JA cadastrado ("Selecionar
-- profissional existente"), e ai o painel manda upsert. Estes dois statements
-- provam que as restricoes unicas que o `onConflict` mira existem com
-- exatamente estas colunas — se alguma sumir, o upsert vira erro 42P10 na tela.
insert into myia_professional_services (professional_id, service_id, mode, price)
select p.id, i.service_id, 'GRUPO', 200 from t_prof p, t_ids i
on conflict (professional_id, service_id) do update set mode = excluded.mode;

insert into myia_professional_availability (
  professional_id, service_id, weekday, start_time, end_time, max_simultaneous_clients
)
select p.id, i.service_id, 1, '08:00', '18:00', 1 from t_prof p, t_ids i
on conflict (professional_id, service_id, weekday, start_time)
do update set end_time = excluded.end_time;

select 'upsert duplicou a agenda em vez de atualizar'
  where (
    select count(*) from myia_professional_availability a
    join t_prof p on p.id = a.professional_id) <> 1;

select 'upsert nao atualizou o fim do expediente'
  where not exists (
    select 1 from myia_professional_availability a
    join t_prof p on p.id = a.professional_id
    where a.end_time = time '18:00');

-- ---------------------------------------------------------------------------
-- O painel grava pelo browser, como `authenticated` e sob RLS — nao como o
-- superuser que roda os statements acima. Aqui provamos o caminho real: se a
-- policy negasse o insert, o cadastro voltaria a falhar na cara do usuario.
-- Requer o seed (scripts/db-apply.mjs supabase/seed.sql), igual ao 0009.
-- ---------------------------------------------------------------------------
set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
set local role authenticated;

select 'impersonacao nao resolveu para a clinica A'
  where auth_company_id() is distinct from 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;

create temporary table t_prof_rls (id uuid) on commit drop;

with novo as (
  insert into myia_professionals_medical (company_id, nome, atende_cat_idade)
  values (auth_company_id(), 'Profissional RLS', array['ADULTO'])
  returning id
)
insert into t_prof_rls (id) select id from novo;

select 'insert sob RLS nao ficou visivel para o proprio tenant'
  where not exists (
    select 1 from myia_professionals_medical m
    join t_prof_rls p on p.id = m.id
    where m.company_id = auth_company_id());

reset role;
