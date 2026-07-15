create table if not exists myia_professionals_medical (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,
  nome text not null,
  formacao text,
  especialidade text,
  registro text,
  atende_cat_idade text[],
  convenios_aceitos text[],
  horarios_atendimento jsonb,
  email text,
  telefone text,
  observacoes text,
  search_tags text[],
  notificame_dia boolean default false,
  notificame_horas boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_professionals_company on myia_professionals_medical(company_id);

create table if not exists myia_professional_services (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references myia_professionals_medical(id) on delete cascade,
  service_id uuid not null references myia_services(id) on delete cascade,
  mode text,            -- INDIVIDUAL | GRUPO | AMBOS
  max_people integer,
  price numeric(10,2),
  created_at timestamptz not null default now(),
  unique (professional_id, service_id)
);
create index if not exists idx_prof_services_prof on myia_professional_services(professional_id);

create table if not exists myia_professional_availability (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references myia_professionals_medical(id) on delete cascade,
  service_id uuid not null references myia_services(id) on delete cascade,
  weekday integer not null,  -- 1=Segunda ... 7=Domingo
  start_time time not null,
  end_time time not null,
  max_simultaneous_clients integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (professional_id, service_id, weekday, start_time)
);
create index if not exists idx_availability_prof on myia_professional_availability(professional_id);

create table if not exists myia_appointments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references myia_companies(id) on delete cascade,
  professional_id uuid not null references myia_professionals_medical(id) on delete cascade,
  service_id uuid not null references myia_services(id) on delete cascade,
  client_id uuid references myia_contacts(id) on delete set null,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'scheduled', -- scheduled|completed|cancelled|no_show|rescheduled
  notes text,
  location text,
  appointment_type text,  -- individual|group
  convenio_usado text,
  valor_cobrado numeric(10,2),
  cliente_nome text,
  cliente_telefone text,
  cliente_email text,
  pesquisa text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_appointments_company on myia_appointments(company_id);
create index if not exists idx_appointments_date on myia_appointments(appointment_date);
