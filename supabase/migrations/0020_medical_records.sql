-- myia_medical_records — o prontuário.
--
-- Não existia nada de registro clínico no schema: `myia_appointments` guarda o
-- agendamento (quem, quando, quanto), não o que aconteceu na consulta. Esta
-- tabela é o destino do que a IA vai escrever a partir da transcrição, numa
-- próxima etapa; por ora ela é preenchida pelo seed de demonstração e lida pela
-- tela /pro/prontuario.
--
-- Procedência e revisão são COLUNAS, não convenção de texto: a tela precisa
-- dizer sem ambiguidade o que veio de IA e em que estado de revisão está, e um
-- prontuário assinado tem peso legal diferente de um rascunho.

create table if not exists myia_medical_records (
  id uuid primary key default gen_random_uuid(),
  company_id      uuid not null references myia_companies(id) on delete cascade,
  appointment_id  uuid not null references myia_appointments(id) on delete cascade,
  professional_id uuid not null references myia_professionals_medical(id) on delete cascade,
  contact_id      uuid references myia_contacts(id) on delete set null,

  -- Denormalizado de propósito: a lista ordena e filtra por data da consulta, e
  -- o PostgREST não ordena por coluna embedada sem ginástica de !inner. O índice
  -- abaixo cobre (professional_id, record_date desc) num acesso só.
  record_date date not null,

  chief_complaint text,   -- queixa principal
  anamnesis       text,
  physical_exam   text,
  assessment      text,   -- hipótese diagnóstica
  plan            text,   -- conduta

  source          text not null default 'ai' check (source in ('ai', 'manual')),
  ai_model        text,
  ai_generated_at timestamptz,

  review_status text not null default 'pending'
    check (review_status in ('pending', 'reviewed', 'signed')),
  reviewed_at timestamptz,
  signed_at   timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Um prontuário por atendimento.
  unique (appointment_id)
);

-- `professional_id` é redundante com `appointment_id` — DE PROPÓSITO. É o que
-- transforma o predicado de RLS numa comparação de coluna em vez de um EXISTS
-- contra myia_appointments, avaliado por linha.
--
-- Para a redundância não virar mentira, a FK é composta: o par
-- (appointment_id, professional_id) tem de existir junto em myia_appointments.
-- Assim é impossível gravar um prontuário atribuindo-o a um médico que não fez
-- aquele atendimento.
-- Ordem importa nos drops: a FK composta DEPENDE do índice único, então soltar
-- o único primeiro aborta com "other objects depend on it" e a migration deixa
-- de ser reexecutável. Derruba-se a dependente antes da dependência.
alter table myia_medical_records
  drop constraint if exists myia_medical_records_appointment_professional_fk;
alter table myia_appointments
  drop constraint if exists myia_appointments_id_professional_uk;
alter table myia_appointments
  add constraint myia_appointments_id_professional_uk unique (id, professional_id);

alter table myia_medical_records
  add constraint myia_medical_records_appointment_professional_fk
  foreign key (appointment_id, professional_id)
  references myia_appointments (id, professional_id)
  on delete cascade;

-- A FK simples que o `references` inline criou vira REDUNDANTE: a composta
-- acima já garante integridade referencial sobre appointment_id, com uma
-- garantia a mais.
--
-- E redundante aqui não é inofensivo. Com duas chaves entre as mesmas tabelas o
-- PostgREST não sabe qual usar num embed e recusa a consulta inteira:
--   "Could not embed because more than one relationship was found" (PGRST201).
-- Ou seja: a lista de prontuários não carregava. Ou se dropa a duplicata, ou
-- toda consulta passa a citar o nome do constraint — melhor resolver na origem.
alter table myia_medical_records
  drop constraint if exists myia_medical_records_appointment_id_fkey;

-- Não faço o mesmo para company_id: exigiria um terceiro índice único em
-- myia_appointments, e a coerência de empresa já vem por transitividade —
-- o professional_id do médico é validado contra a empresa dele pela FK composta
-- de myia_users (0018), e o agendamento pertence à mesma empresa do profissional.

create index if not exists idx_medical_records_prof_date
  on myia_medical_records(professional_id, record_date desc);
create index if not exists idx_medical_records_company_date
  on myia_medical_records(company_id, record_date desc);
create index if not exists idx_medical_records_contact
  on myia_medical_records(contact_id);

alter table myia_medical_records enable row level security;

-- O owner lê e escreve o prontuário da própria clínica, por consistência com
-- todas as outras tabelas. Se a decisão clínica for "administrador não lê
-- prontuário", esta policy é o único ponto a mudar.
drop policy if exists medical_records_owner_all on myia_medical_records;
create policy medical_records_owner_all on myia_medical_records
  for all
  using      (company_id = (select auth_company_id()) and (select app_role()) = 'owner')
  with check (company_id = (select auth_company_id()) and (select app_role()) = 'owner');

-- O profissional lê SÓ os prontuários que ele assinou. Somente leitura: revisar
-- e assinar são ações de uma próxima etapa, e a tela desabilita esses botões em
-- vez de oferecer algo que o RLS recusaria.
drop policy if exists medical_records_professional_read on myia_medical_records;
create policy medical_records_professional_read on myia_medical_records
  for select using (
    (select app_role()) = 'professional'
    and company_id      = (select auth_company_id())
    and professional_id = (select auth_professional_id())
  );

grant select, insert, update, delete on myia_medical_records
  to anon, authenticated, service_role;
