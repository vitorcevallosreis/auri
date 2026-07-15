select 'appointments.company_id ainda nullable' where exists (
  select 1 from information_schema.columns
  where table_name = 'myia_appointments'
    and column_name = 'company_id'
    and is_nullable = 'YES'
);
