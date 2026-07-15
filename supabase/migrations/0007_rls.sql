-- Helper: policy padrão por company_id direto
do $$
declare t text;
begin
  foreach t in array array[
    'myia_assistants','myia_contacts','myia_chat','myia_categories','myia_products',
    'myia_services','myia_company_addresses','myia_company_agreements',
    'myia_company_payment_methods','myia_company_policies','myia_specialties',
    'myia_professionals_medical','myia_appointments'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format($f$create policy %1$s_tenant_all on %1$s
      for all using (company_id = auth_company_id())
      with check (company_id = auth_company_id());$f$, t);
  end loop;
end $$;

-- LLMs: catálogo global, leitura para qualquer autenticado
alter table myia_assistants_llms enable row level security;
create policy llms_read on myia_assistants_llms for select using (auth.role() = 'authenticated');

-- Tabelas-filhas isolam via join ao pai
alter table myia_channels enable row level security;
create policy channels_tenant on myia_channels for all
  using (exists (select 1 from myia_assistants a where a.id = assistant_id and a.company_id = auth_company_id()))
  with check (exists (select 1 from myia_assistants a where a.id = assistant_id and a.company_id = auth_company_id()));

alter table myia_settings_assistants enable row level security;
create policy settings_tenant on myia_settings_assistants for all
  using (exists (select 1 from myia_assistants a where a.id = assistant_id and a.company_id = auth_company_id()))
  with check (exists (select 1 from myia_assistants a where a.id = assistant_id and a.company_id = auth_company_id()));

alter table myia_messages enable row level security;
create policy messages_tenant on myia_messages for all
  using (exists (select 1 from myia_chat c where c.id = chat_id and c.company_id = auth_company_id()))
  with check (exists (select 1 from myia_chat c where c.id = chat_id and c.company_id = auth_company_id()));

alter table myia_professional_services enable row level security;
create policy prof_services_tenant on myia_professional_services for all
  using (exists (select 1 from myia_professionals_medical p where p.id = professional_id and p.company_id = auth_company_id()))
  with check (exists (select 1 from myia_professionals_medical p where p.id = professional_id and p.company_id = auth_company_id()));

alter table myia_professional_availability enable row level security;
create policy availability_tenant on myia_professional_availability for all
  using (exists (select 1 from myia_professionals_medical p where p.id = professional_id and p.company_id = auth_company_id()))
  with check (exists (select 1 from myia_professionals_medical p where p.id = professional_id and p.company_id = auth_company_id()));
