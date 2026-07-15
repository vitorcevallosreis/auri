select 'myia_assistants ausente' where to_regclass('public.myia_assistants') is null;
select 'coluna step_by_step ausente' where not exists (
  select 1 from information_schema.columns
  where table_name='myia_assistants' and column_name='step_by_step');
select 'myia_channels ausente' where to_regclass('public.myia_channels') is null;
select 'myia_assistants_llms ausente' where to_regclass('public.myia_assistants_llms') is null;
select 'myia_settings_assistants ausente' where to_regclass('public.myia_settings_assistants') is null;
