create table if not exists myia_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,
  name text not null
);
create index if not exists idx_categories_company on myia_categories(company_id);

create table if not exists myia_products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,
  category_id uuid references myia_categories(id) on delete set null,
  name text not null,
  price numeric(10,2) not null default 0,
  description text,
  available boolean not null default true,
  image_path text,
  created_at timestamptz not null default now()
);
create index if not exists idx_products_company on myia_products(company_id);

create table if not exists myia_services (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references myia_companies(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null default 0,
  description text,
  tempo_medio text,
  available boolean not null default true,
  image_path text,
  aceita_convenio boolean not null default false,
  valores_convenios jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_services_company on myia_services(company_id);
