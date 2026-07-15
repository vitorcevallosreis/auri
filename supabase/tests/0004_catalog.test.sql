select 'myia_categories ausente' where to_regclass('public.myia_categories') is null;
select 'myia_products ausente'   where to_regclass('public.myia_products') is null;
select 'myia_services ausente'   where to_regclass('public.myia_services') is null;
select 'coluna valores_convenios ausente' where not exists (
  select 1 from information_schema.columns
  where table_name='myia_services' and column_name='valores_convenios');
