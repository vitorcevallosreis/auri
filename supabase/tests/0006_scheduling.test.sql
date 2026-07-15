select 'myia_professionals_medical ausente'    where to_regclass('public.myia_professionals_medical') is null;
select 'myia_professional_services ausente'    where to_regclass('public.myia_professional_services') is null;
select 'myia_professional_availability ausente' where to_regclass('public.myia_professional_availability') is null;
select 'myia_appointments ausente'             where to_regclass('public.myia_appointments') is null;
select 'coluna horarios_atendimento ausente' where not exists (
  select 1 from information_schema.columns
  where table_name='myia_professionals_medical' and column_name='horarios_atendimento');
