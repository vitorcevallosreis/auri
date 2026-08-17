-- Plano 3 (P3.1) — Canal WhatsApp Cloud API (Meta), substituindo o Evolution.
--
-- O Plano 2 modelou o canal no formato do Evolution: myia_channels carrega
-- "instanceWpp", "token", "urlapi" e qrcode64. A API oficial tem outra
-- identidade (waba_id + phone_number_id, token OAuth por tenant obtido via
-- Embedded Signup) e outro modelo de segredo, então ganha tabela própria em vez
-- de sobrecarregar as colunas do Evolution com outro significado.

-- ---------------------------------------------------------------------------
-- (a) Discriminador de provedor no canal existente
-- ---------------------------------------------------------------------------
alter table myia_channels
  add column if not exists provider text not null default 'cloud';

alter table myia_channels
  drop constraint if exists myia_channels_provider_check;

alter table myia_channels
  add constraint myia_channels_provider_check
  check (provider in ('cloud', 'evolution'));

-- ---------------------------------------------------------------------------
-- (b) Identidade do número na Cloud API
-- ---------------------------------------------------------------------------
-- company_id fica AQUI (e não só via myia_channels.assistant_id) porque o
-- webhook da Meta chega identificado apenas por phone_number_id: o handler
-- precisa resolver o tenant numa única leitura, antes de saber qual assistente
-- atende. Ver idx/uq abaixo.
create table if not exists myia_wa_cloud_numbers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,

  -- Identidade na Meta
  waba_id text not null,
  phone_number_id text not null,
  display_number text,
  verified_name text,
  quality_rating text,

  -- Segredo. Ciphertext AES-256-GCM produzido em src/lib/crypto/secretBox.ts;
  -- o banco nunca vê o valor claro e o cliente nunca lê esta coluna (ver (d)).
  access_token_encrypted text,
  token_updated_at timestamptz,

  status text not null default 'pending',
  verified_at timestamptz,
  created_at timestamptz not null default now(),

  constraint myia_wa_cloud_numbers_status_check
    check (status in ('pending', 'connected', 'disconnected', 'error'))
);

-- Chave de roteamento do webhook: um phone_number_id pertence a um só tenant.
create unique index if not exists uq_wa_cloud_phone_number_id
  on myia_wa_cloud_numbers (phone_number_id);

create index if not exists idx_wa_cloud_company
  on myia_wa_cloud_numbers (company_id);

-- Liga o número ao canal (que por sua vez aponta o assistente que atende).
alter table myia_channels
  add column if not exists cloud_number_id uuid
  references myia_wa_cloud_numbers(id) on delete set null;

-- ÚNICO e parcial: um número da Cloud API é atendido por um só canal, e o
-- upsert do callback do Embedded Signup usa `onConflict: cloud_number_id` —
-- que exige índice único para funcionar. Parcial porque canais do Evolution
-- (em remoção) têm cloud_number_id nulo e NULLs não devem colidir.
create unique index if not exists uq_channels_cloud_number
  on myia_channels (cloud_number_id)
  where cloud_number_id is not null;

-- ---------------------------------------------------------------------------
-- (c) RLS multi-tenant, no mesmo padrão da migration 0007
-- ---------------------------------------------------------------------------
alter table myia_wa_cloud_numbers enable row level security;

drop policy if exists myia_wa_cloud_numbers_tenant_all on myia_wa_cloud_numbers;

create policy myia_wa_cloud_numbers_tenant_all on myia_wa_cloud_numbers
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

-- ---------------------------------------------------------------------------
-- (d) Grants de COLUNA — o cliente nunca lê o token
-- ---------------------------------------------------------------------------
-- A 0009 concedeu select/insert/update/delete em TODAS as tabelas do schema
-- para anon e authenticated, e deixou `alter default privileges` ligado — ou
-- seja, esta tabela nasceria legível pelo browser inteira, token incluso. Foi
-- exatamente assim que o tracker #14 aconteceu com myia_channels.token.
--
-- RLS restringe LINHA, não COLUNA: a política acima deixa a clínica ler as
-- próprias linhas, e isso incluiria o access_token. A proteção correta é grant
-- por coluna.
revoke all on myia_wa_cloud_numbers from anon, authenticated;

-- Colunas seguras para a UI de Channels (status da conexão, número exibido).
-- access_token_encrypted e token_updated_at ficam DE FORA de propósito.
grant select (
  id, company_id, waba_id, phone_number_id, display_number,
  verified_name, quality_rating, status, verified_at, created_at
) on myia_wa_cloud_numbers to authenticated;

-- Escrita só pelo servidor: o vínculo do número acontece no callback do
-- Embedded Signup, que roda com service role.
grant all on myia_wa_cloud_numbers to service_role;

-- ---------------------------------------------------------------------------
-- (e) Idempotência do webhook — reaproveita o índice da 0011
-- ---------------------------------------------------------------------------
-- A Meta reentrega o webhook quando não recebe 200 a tempo. Não criamos índice
-- novo: o handler grava phone_number_id em myia_messages.instance_id, então o
-- uq_messages_instance_msgid (instance_id, message_id) da migration 0011 já
-- garante "uma linha por mensagem por número". O wamid da Meta é único global,
-- o par continua único.
comment on index uq_messages_instance_msgid is
  'Idempotência de ingress. Evolution: (instance, message_id). Cloud API: (phone_number_id, wamid).';
