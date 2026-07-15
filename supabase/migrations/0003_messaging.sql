create table if not exists myia_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,
  name text not null,
  avatar_url text,
  remote_jid text,
  number text,
  checked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_contacts_company on myia_contacts(company_id);

create table if not exists myia_chat (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,
  contact_id uuid references myia_contacts(id) on delete set null,
  channel_name text,
  instance_id text,
  labels text[],
  muted boolean not null default false,
  archived boolean not null default false,
  bot_running boolean not null default false,
  chat_pause boolean not null default false,
  last_message jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists idx_chat_company on myia_chat(company_id);
create index if not exists idx_chat_contact on myia_chat(contact_id);

create table if not exists myia_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references myia_chat(id) on delete cascade,
  from_me boolean not null default false,
  message_id text,
  key jsonb,
  message_type text,
  message jsonb,
  message_timestamp bigint,
  instance_id text,
  status text not null default 'PENDING',
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_chat on myia_messages(chat_id);
create index if not exists idx_messages_message_id on myia_messages(message_id);
