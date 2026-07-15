-- Toda tabela de tenant deve ter rowsecurity = true
select tablename || ' sem RLS' from pg_tables
where schemaname='public' and tablename in (
  'myia_assistants','myia_contacts','myia_chat','myia_messages','myia_categories',
  'myia_products','myia_services','myia_company_addresses','myia_company_agreements',
  'myia_company_payment_methods','myia_company_policies','myia_specialties',
  'myia_professionals_medical','myia_professional_services','myia_professional_availability',
  'myia_appointments','myia_channels','myia_settings_assistants')
and rowsecurity = false;
