-- RLS por papel: separar owner de profissional.
--
-- POR QUE ESTA MIGRATION É OBRIGATÓRIA e não uma melhoria incremental:
-- as policies de 0007 são PERMISSIVE e o médico é, para todos os efeitos, um
-- usuário da empresa — `auth_company_id()` devolve a clínica para ele também.
-- Se nos limitássemos a ACRESCENTAR policies de profissional, as antigas
-- `<tabela>_tenant_all` continuariam valendo em OR e o médico enxergaria (e
-- escreveria) o tenant inteiro. Apertar 0007 é o que faz o escopo existir.
--
-- SEIS tabelas não estão no loop de 0007 e por isso passam despercebidas — cada
-- uma criou a própria policy na sua migration, no mesmo padrão por company_id:
--   myia_services_searches   (0012)  buscas de serviço
--   myia_wa_cloud_numbers    (0013)  configuração do WhatsApp Business
--   myia_agent_jobs          (0014)  fila de trabalhos do agente
--   myia_agent_runs          (0015)  rastro de execução do agente
--   myia_agent_tool_calls    (0015)  idem, via join em runs
--   myia_appointment_feedback(0016)  respostas de pesquisa
-- Sem elas nesta lista o médico leria os feedbacks e as buscas da clínica
-- inteira, a configuração do WhatsApp e o rastro dos agentes — que carrega
-- conteúdo de conversa de paciente. Foram encontradas auditando `pg_policies`
-- DEPOIS da primeira aplicação, não lendo as migrations: é a diferença entre
-- conferir o catálogo e confiar na lista que a gente montou de cabeça.
--
-- Detalhe de desempenho adotado em toda a migration: as chamadas de função vão
-- envolvidas em `(select ...)`. O Postgres promove isso a InitPlan e avalia UMA
-- vez por query, em vez de uma vez por linha. Semanticamente idêntico; com ~1,8k
-- agendamentos é a diferença entre 1 e 1849 chamadas.
--
-- REVERSÃO: derrubar as policies `*_owner_all` / `*_professional_read` criadas
-- aqui e reaplicar 0007_rls.sql restaura o comportamento anterior.

-- ============================================================ 1. OWNER-ONLY
-- As 13 tabelas do loop de 0007 + as 2 que ficaram de fora.
do $$
declare t text;
begin
  foreach t in array array[
    'myia_assistants','myia_contacts','myia_chat','myia_categories','myia_products',
    'myia_services','myia_company_addresses','myia_company_agreements',
    'myia_company_payment_methods','myia_company_policies','myia_specialties',
    'myia_professionals_medical','myia_appointments',
    'myia_services_searches','myia_appointment_feedback',
    'myia_wa_cloud_numbers','myia_agent_jobs'
  ] loop
    execute format('drop policy if exists %1$s_tenant_all on %1$s;', t);
    execute format('drop policy if exists %1$s_owner_all on %1$s;', t);
    -- O `with check` REPETE o predicado de propósito. Sem ele, todo INSERT e
    -- UPDATE do owner passa a ser rejeitado com "new row violates row-level
    -- security policy" — o erro clássico deste tipo de reescrita.
    execute format($f$create policy %1$s_owner_all on %1$s
      for all
      using      (company_id = (select auth_company_id()) and (select app_role()) = 'owner')
      with check (company_id = (select auth_company_id()) and (select app_role()) = 'owner');$f$, t);
  end loop;
end $$;

-- ======================================================== 2. TABELAS-FILHAS
-- Isolam por EXISTS no pai. O pai já é owner-only, então o RLS aninhado bastaria
-- — mas depender disso é frágil e invisível para quem lê a policy. Explícito.
drop policy if exists channels_tenant on myia_channels;
create policy channels_tenant on myia_channels for all
  using (exists (select 1 from myia_assistants a
                 where a.id = assistant_id and a.company_id = (select auth_company_id()))
         and (select app_role()) = 'owner')
  with check (exists (select 1 from myia_assistants a
                      where a.id = assistant_id and a.company_id = (select auth_company_id()))
              and (select app_role()) = 'owner');

drop policy if exists settings_tenant on myia_settings_assistants;
create policy settings_tenant on myia_settings_assistants for all
  using (exists (select 1 from myia_assistants a
                 where a.id = assistant_id and a.company_id = (select auth_company_id()))
         and (select app_role()) = 'owner')
  with check (exists (select 1 from myia_assistants a
                      where a.id = assistant_id and a.company_id = (select auth_company_id()))
              and (select app_role()) = 'owner');

drop policy if exists messages_tenant on myia_messages;
create policy messages_tenant on myia_messages for all
  using (exists (select 1 from myia_chat c
                 where c.id = chat_id and c.company_id = (select auth_company_id()))
         and (select app_role()) = 'owner')
  with check (exists (select 1 from myia_chat c
                      where c.id = chat_id and c.company_id = (select auth_company_id()))
              and (select app_role()) = 'owner');

drop policy if exists prof_services_tenant on myia_professional_services;
create policy prof_services_tenant on myia_professional_services for all
  using (exists (select 1 from myia_professionals_medical p
                 where p.id = professional_id and p.company_id = (select auth_company_id()))
         and (select app_role()) = 'owner')
  with check (exists (select 1 from myia_professionals_medical p
                      where p.id = professional_id and p.company_id = (select auth_company_id()))
              and (select app_role()) = 'owner');

drop policy if exists availability_tenant on myia_professional_availability;
create policy availability_tenant on myia_professional_availability for all
  using (exists (select 1 from myia_professionals_medical p
                 where p.id = professional_id and p.company_id = (select auth_company_id()))
         and (select app_role()) = 'owner')
  with check (exists (select 1 from myia_professionals_medical p
                      where p.id = professional_id and p.company_id = (select auth_company_id()))
              and (select app_role()) = 'owner');

-- myia_agent_runs e myia_agent_tool_calls são SELECT-only desde 0015 (só o
-- service role escreve). Mantemos o verbo e acrescentamos o papel.
drop policy if exists myia_agent_runs_tenant_read on myia_agent_runs;
create policy myia_agent_runs_tenant_read on myia_agent_runs
  for select using (
    company_id = (select auth_company_id()) and (select app_role()) = 'owner'
  );

drop policy if exists myia_agent_tool_calls_tenant_read on myia_agent_tool_calls;
create policy myia_agent_tool_calls_tenant_read on myia_agent_tool_calls
  for select using (
    exists (select 1 from myia_agent_runs r
            where r.id = myia_agent_tool_calls.run_id
              and r.company_id = (select auth_company_id()))
    and (select app_role()) = 'owner'
  );

-- myia_assistants_llms fica como está: é catálogo GLOBAL de modelos, sem
-- company_id, legível por qualquer autenticado desde 0007:20. Não há nada de
-- um tenant ali para vazar.

-- ======================================================= 3. EMPRESA E USUÁRIOS
-- myia_companies: o médico precisa do NOME da clínica para o cabeçalho, então o
-- SELECT continua aberto aos dois papéis. Só a escrita vira owner-only.
drop policy if exists company_select_own on myia_companies;
create policy company_select_own on myia_companies
  for select using (id = (select auth_company_id()));

drop policy if exists company_update_own on myia_companies;
create policy company_update_own on myia_companies
  for update
  using      (id = (select auth_company_id()) and (select app_role()) = 'owner')
  with check (id = (select auth_company_id()) and (select app_role()) = 'owner');

-- myia_users: hoje qualquer usuário lê TODAS as linhas da empresa. Depois de
-- 0018 essas linhas mapeiam login -> profissional, e o médico não precisa disso.
--
-- O ramo `id = auth.uid()` é o que mantém o login funcionando para os DOIS
-- papéis: src/contexts/Auth/index.tsx lê a própria linha logo após autenticar
-- para descobrir company_id e role. Sem ele, ninguém entra.
--
-- Aqui `auth.uid()` vai sem o embrulho `(select ...)`: o predicado é uma
-- comparação com a PK e o planejador já resolve por índice.
drop policy if exists users_select_own_company on myia_users;
drop policy if exists users_select_self_or_owner on myia_users;
create policy users_select_self_or_owner on myia_users
  for select using (
    id = auth.uid()
    or (company_id = (select auth_company_id()) and (select app_role()) = 'owner')
  );

-- Continua não existindo policy de INSERT/UPDATE/DELETE em myia_users: criar
-- login segue sendo exclusividade do service role.

-- ==================================================== 4. LEITURA DO PROFISSIONAL
-- Somente SELECT, e somente nas tabelas que as três telas de /pro precisam.
-- Todo predicado começa por `app_role() = 'professional'`, então estas policies
-- são inertes para o owner — quem manda nele é o bloco 1.

-- 4.1 Agendamentos dele.
drop policy if exists appointments_professional_read on myia_appointments;
create policy appointments_professional_read on myia_appointments
  for select using (
    (select app_role()) = 'professional'
    and company_id      = (select auth_company_id())
    and professional_id = (select auth_professional_id())
  );

-- 4.2 A própria linha no catálogo — nome, especialidade e registro para o
--     cabeçalho de "Meu Dia". Não os colegas.
drop policy if exists professionals_self_read on myia_professionals_medical;
create policy professionals_self_read on myia_professionals_medical
  for select using (
    (select app_role()) = 'professional'
    and id = (select auth_professional_id())
  );

-- 4.3 Pacientes: SÓ quem tem ao menos um agendamento com ele.
--     O EXISTS já seria filtrado pelo RLS de myia_appointments (que restringe ao
--     profissional), mas o predicado é repetido de propósito: depender de RLS
--     aninhado é correto e ilegível, e some no primeiro refactor.
--     Custo coberto por idx_appointments_professional_client (0018).
drop policy if exists contacts_professional_read on myia_contacts;
create policy contacts_professional_read on myia_contacts
  for select using (
    (select app_role()) = 'professional'
    and company_id = (select auth_company_id())
    and exists (
      select 1 from myia_appointments a
      where a.client_id       = myia_contacts.id
        and a.professional_id = (select auth_professional_id())
    )
  );

-- 4.4 Feedback dos atendimentos dele. A tabela não tem professional_id (0016);
--     o vínculo é pelo appointment.
drop policy if exists feedback_professional_read on myia_appointment_feedback;
create policy feedback_professional_read on myia_appointment_feedback
  for select using (
    (select app_role()) = 'professional'
    and company_id = (select auth_company_id())
    and exists (
      select 1 from myia_appointments a
      where a.id              = myia_appointment_feedback.appointment_id
        and a.professional_id = (select auth_professional_id())
    )
  );

-- 4.5 Catálogo de serviços da clínica.
--     Escolha deliberada de NÃO restringir aos serviços que ele já atendeu: o
--     nome e o valor do serviço já estão na linha do agendamento que ele lê
--     legitimamente. Isto é a lista de preços, não a receita da clínica — um
--     EXISTS por linha aqui custaria sem proteger nada.
drop policy if exists services_professional_read on myia_services;
create policy services_professional_read on myia_services
  for select using (
    (select app_role()) = 'professional'
    and company_id = (select auth_company_id())
  );

-- NENHUMA policy de profissional em: myia_chat, myia_messages, myia_assistants,
-- myia_channels, myia_settings_assistants, myia_products, myia_categories,
-- myia_company_addresses/agreements/payment_methods/policies, myia_specialties,
-- myia_professional_services, myia_professional_availability,
-- myia_services_searches. Nenhuma das três telas precisa, e o silêncio aqui é o
-- que garante que o médico não veja.
