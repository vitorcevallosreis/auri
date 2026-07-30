-- Testes da migration 0013 (canal WhatsApp Cloud API).
-- Convenção do runner: o arquivo PASSA se nenhum statement retornar linha.
-- Cada select abaixo retorna linha só quando a asserção falha.

-- ---------------------------------------------------------------------------
-- (1) O segredo não pode ser legível pelo cliente
-- ---------------------------------------------------------------------------
-- Esta é a asserção mais importante do arquivo: foi exatamente esta classe de
-- erro (grant amplo demais em coluna de segredo) que gerou o tracker #14 com
-- myia_channels.token. RLS filtra LINHA, não COLUNA — sem grant por coluna, a
-- clínica leria o próprio access token pelo browser.
select 'FALHA: authenticated consegue ler access_token_encrypted' as erro
where has_column_privilege('authenticated', 'myia_wa_cloud_numbers', 'access_token_encrypted', 'SELECT');

select 'FALHA: anon consegue ler access_token_encrypted' as erro
where has_column_privilege('anon', 'myia_wa_cloud_numbers', 'access_token_encrypted', 'SELECT');

select 'FALHA: authenticated consegue ler token_updated_at' as erro
where has_column_privilege('authenticated', 'myia_wa_cloud_numbers', 'token_updated_at', 'SELECT');

-- Escrita é só do servidor (callback do Embedded Signup, service role).
select 'FALHA: authenticated consegue escrever na tabela' as erro
where has_table_privilege('authenticated', 'myia_wa_cloud_numbers', 'INSERT')
   or has_table_privilege('authenticated', 'myia_wa_cloud_numbers', 'UPDATE')
   or has_table_privilege('authenticated', 'myia_wa_cloud_numbers', 'DELETE');

-- ---------------------------------------------------------------------------
-- (2) ...mas as colunas de status seguem legíveis, senão a UI de Channels quebra
-- ---------------------------------------------------------------------------
select 'FALHA: authenticated NÃO lê ' || c as erro
from unnest(array['phone_number_id','display_number','status','verified_name','waba_id']) as c
where not has_column_privilege('authenticated', 'myia_wa_cloud_numbers', c, 'SELECT');

-- service_role precisa de tudo (é quem grava no callback).
select 'FALHA: service_role não lê access_token_encrypted' as erro
where not has_column_privilege('service_role', 'myia_wa_cloud_numbers', 'access_token_encrypted', 'SELECT');

-- ---------------------------------------------------------------------------
-- (3) RLS ligada e política de tenant presente
-- ---------------------------------------------------------------------------
select 'FALHA: RLS desligada em myia_wa_cloud_numbers' as erro
from pg_class
where relname = 'myia_wa_cloud_numbers' and not relrowsecurity;

select 'FALHA: policy de tenant ausente' as erro
where not exists (
  select 1 from pg_policies
  where tablename = 'myia_wa_cloud_numbers'
    and policyname = 'myia_wa_cloud_numbers_tenant_all'
);

-- ---------------------------------------------------------------------------
-- (4) Índices que o código depende
-- ---------------------------------------------------------------------------
-- phone_number_id é a chave de roteamento do webhook: um número, um tenant.
select 'FALHA: uq_wa_cloud_phone_number_id ausente ou não-único' as erro
where not exists (
  select 1 from pg_indexes i
  join pg_class c on c.relname = i.indexname
  join pg_index x on x.indexrelid = c.oid
  where i.indexname = 'uq_wa_cloud_phone_number_id' and x.indisunique
);

-- O upsert do callback usa onConflict: cloud_number_id — exige índice único.
select 'FALHA: uq_channels_cloud_number ausente ou não-único' as erro
where not exists (
  select 1 from pg_indexes i
  join pg_class c on c.relname = i.indexname
  join pg_index x on x.indexrelid = c.oid
  where i.indexname = 'uq_channels_cloud_number' and x.indisunique
);

-- Idempotência do ingress reaproveitada da 0011 (instance_id = phone_number_id).
select 'FALHA: uq_messages_instance_msgid sumiu' as erro
where not exists (
  select 1 from pg_indexes where indexname = 'uq_messages_instance_msgid'
);

-- ---------------------------------------------------------------------------
-- (5) Discriminador de provedor
-- ---------------------------------------------------------------------------
select 'FALHA: myia_channels.provider ausente' as erro
where not exists (
  select 1 from information_schema.columns
  where table_name = 'myia_channels' and column_name = 'provider'
);

select 'FALHA: myia_channels.cloud_number_id ausente' as erro
where not exists (
  select 1 from information_schema.columns
  where table_name = 'myia_channels' and column_name = 'cloud_number_id'
);

-- O check só aceita os dois provedores conhecidos.
select 'FALHA: check de provider aceita valor inválido' as erro
where not exists (
  select 1 from pg_constraint
  where conname = 'myia_channels_provider_check'
);
