create table if not exists myia_assistants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,
  name text not null,
  paused boolean not null default false,
  purpose text,
  description text,
  avatar text,
  llm text,
  objective text,
  identity text,
  greetings text,
  strategy text,
  behavior text,
  behavior_text text,
  fallbacks text,
  avoided_topics text,
  step_by_step text,
  goodbye text,
  roles text,
  tel_fallback text,
  created_at timestamptz not null default now()
);
create index if not exists idx_assistants_company on myia_assistants(company_id);

-- Catálogo global de LLMs (sem company_id; leitura pública autenticada)
create table if not exists myia_assistants_llms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  enabled boolean not null default true,
  icon text
);

create table if not exists myia_settings_assistants (
  id uuid primary key default gen_random_uuid(),
  assistant_id uuid not null references myia_assistants(id) on delete cascade,
  instance_conection text,
  used_tokens bigint not null default 0,
  available_tokens bigint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_settings_assistant on myia_settings_assistants(assistant_id);

create table if not exists myia_channels (
  id uuid primary key default gen_random_uuid(),
  assistant_id uuid not null references myia_assistants(id) on delete cascade,
  nome text,
  "tipoConexao" text,
  titular text,
  "ultimaAtualizacao" timestamptz,
  "numeroTel" text,
  "fotoPerfil" text,
  token text,
  urlapi text,
  "apiUtilizada" text,
  status text not null default 'created',
  qrcode64 text,
  pairing_code text,
  looping_qrcode integer default 0,
  "instanceWpp" text,
  "remoteJid" text,
  created_at timestamptz not null default now()
);
create index if not exists idx_channels_assistant on myia_channels(assistant_id);
