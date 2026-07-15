create table if not exists myia_company_addresses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,
  zip_code text,
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state_code text,
  state text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);
create index if not exists idx_addresses_company on myia_company_addresses(company_id);

create table if not exists myia_company_agreements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,
  name text not null,
  status boolean not null default true,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_agreements_company on myia_company_agreements(company_id);

create table if not exists myia_company_payment_methods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,
  name text not null,
  status boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_payment_methods_company on myia_company_payment_methods(company_id);

create table if not exists myia_company_policies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,
  name text not null,
  description text,
  status boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_policies_company on myia_company_policies(company_id);

create table if not exists myia_specialties (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);
create index if not exists idx_specialties_company on myia_specialties(company_id);
