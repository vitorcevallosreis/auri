select 'myia_contacts ausente' where to_regclass('public.myia_contacts') is null;
select 'myia_chat ausente'     where to_regclass('public.myia_chat') is null;
select 'myia_messages ausente' where to_regclass('public.myia_messages') is null;
select 'coluna message_id ausente' where not exists (
  select 1 from information_schema.columns
  where table_name='myia_messages' and column_name='message_id');
