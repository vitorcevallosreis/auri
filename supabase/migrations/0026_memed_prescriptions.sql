-- Prescrição digital via Memed.
--
-- A Memed é a plataforma de receita; nós não emitimos receita nenhuma. O que
-- este schema guarda é (a) o que a Memed precisa saber sobre o prescritor para
-- cadastrá-lo, e (b) o comprovante do que foi prescrito, para o prontuário
-- não ficar cego a um ato clínico que aconteceu dentro de um iframe.
--
-- Fluxo: o backend troca os dados do médico por um token na API da Memed → o
-- front carrega o módulo com esse token → o médico prescreve → o evento
-- `prescricaoImpressa` volta e nós registramos.

-- --------------------------------------------------------------------------
-- 1. O que falta no cadastro do profissional
--
-- A Memed exige CPF e data de nascimento para CRIAR um prescritor, e o
-- conselho em três campos separados (sigla, número, UF). Nós guardávamos o
-- conselho como texto livre em `registro` ("CRM-SP 118432") e não guardávamos
-- CPF nenhum.
-- --------------------------------------------------------------------------
alter table myia_professionals_medical
  add column if not exists cpf text,
  add column if not exists data_nascimento date,
  add column if not exists conselho_sigla  text,
  add column if not exists conselho_numero text,
  add column if not exists conselho_uf     text;

-- CPF só de dígitos. O CHECK é permissivo com o nulo de propósito: a clínica
-- vai preencher isso aos poucos, e um profissional sem CPF continua atendendo
-- normalmente — só não prescreve pela Memed.
alter table myia_professionals_medical
  drop constraint if exists myia_professionals_cpf_formato;
alter table myia_professionals_medical
  add constraint myia_professionals_cpf_formato
  check (cpf is null or cpf ~ '^[0-9]{11}$');

alter table myia_professionals_medical
  drop constraint if exists myia_professionals_conselho_sigla;
alter table myia_professionals_medical
  add constraint myia_professionals_conselho_sigla
  check (conselho_sigla is null or conselho_sigla in
    ('CRM','CRO','COREN','CRMV','CRF','CRN','CREFITO','CRP','CRFa','CREF'));

alter table myia_professionals_medical
  drop constraint if exists myia_professionals_conselho_uf;
alter table myia_professionals_medical
  add constraint myia_professionals_conselho_uf
  check (conselho_uf is null or conselho_uf ~ '^[A-Z]{2}$');

/**
 * Quebra o texto livre de `registro` nos três campos da Memed.
 *
 * É um parser de campo digitado à mão, então ele erra — e por isso os campos
 * são EDITÁVEIS e o backfill abaixo só preenche o que está vazio. A intenção é
 * poupar a redigitação de centenas de cadastros, não ser a fonte da verdade.
 * Formato que ele entende: "CRM-SP 118432", "CRM SP 118432", "CRM/SP 118432",
 * "CREFITO-000". Qualquer outra coisa fica nula para preenchimento manual.
 */
create or replace function parse_registro_conselho(p_registro text)
returns table (sigla text, uf text, numero text)
language sql
immutable
as $$
  -- A UF é extraída com a MESMA lista fechada de conselhos, e não com um
  -- `[A-Z]+` genérico. Com o genérico, "CREFITO-000" faz o motor voltar atrás,
  -- casar só "CREFI" como sigla e entregar "TO" como UF — um estado que não
  -- existe no registro, gravado em silêncio no cadastro. As alternativas vão
  -- da mais longa para a mais curta para CREFITO vencer CREF, e CRMV vencer
  -- CRM.
  select
    (regexp_match(upper(coalesce(p_registro, '')),
      '^\s*(CREFITO|COREN|CRMV|CRFA|CREF|CRM|CRO|CRF|CRN|CRP)'))[1],
    (regexp_match(upper(coalesce(p_registro, '')),
      '^\s*(?:CREFITO|COREN|CRMV|CRFA|CREF|CRM|CRO|CRF|CRN|CRP)[\s/-]*([A-Z]{2})[\s/-]+[0-9]'))[1],
    (regexp_match(coalesce(p_registro, ''), '([0-9]+)\s*$'))[1];
$$;

-- O parse roda numa CTE, e não em `UPDATE ... FROM parse(p.registro)`: um item
-- de FROM não pode referenciar a tabela que o próprio UPDATE está alterando.
-- O `cross join lateral` aqui dentro é legal porque a CTE é um SELECT comum, e
-- garante uma única chamada da função por linha — `(parse(...)).*` chamaria uma
-- vez por coluna lida.
with parsed as (
  select p.id, r.sigla, r.uf, r.numero
    from myia_professionals_medical p
    cross join lateral parse_registro_conselho(p.registro) r
   where p.conselho_sigla is null or p.conselho_numero is null
)
update myia_professionals_medical p
   set conselho_sigla  = coalesce(p.conselho_sigla,
         case when parsed.sigla = 'CRFA' then 'CRFa' else parsed.sigla end),
       conselho_uf     = coalesce(p.conselho_uf, parsed.uf),
       conselho_numero = coalesce(p.conselho_numero, parsed.numero)
  from parsed
 where parsed.id = p.id;

-- --------------------------------------------------------------------------
-- 2. Receitas emitidas
--
-- Guardamos o COMPROVANTE, não a receita. O documento legal vive na Memed e é
-- ela quem assina; duplicar o conteúdo aqui criaria uma segunda versão da
-- receita que poderia divergir da que o paciente recebeu. O que fica é o
-- suficiente para o prontuário mostrar "o que foi prescrito nesta consulta" e
-- para uma auditoria achar o documento lá.
-- --------------------------------------------------------------------------
create table if not exists myia_prescriptions (
  id uuid primary key default gen_random_uuid(),

  company_id        uuid not null references myia_companies(id) on delete cascade,
  professional_id   uuid not null references myia_professionals_medical(id) on delete cascade,
  appointment_id    uuid references myia_appointments(id) on delete set null,
  medical_record_id uuid references myia_medical_records(id) on delete set null,

  -- Identificadores do lado da Memed. O uuid é o que localiza o documento lá.
  memed_uuid text not null,
  memed_id   text,

  -- Resumo do que foi prescrito, como veio no evento `prescricaoImpressa`.
  -- Suficiente para a tela listar; a fonte continua sendo a Memed.
  medicamentos jsonb not null default '[]'::jsonb,
  documentos   jsonb not null default '[]'::jsonb,

  issued_at  timestamptz not null default now(),
  created_at timestamptz not null default now(),

  unique (memed_uuid)
);

create index if not exists idx_prescriptions_record
  on myia_prescriptions(medical_record_id);
create index if not exists idx_prescriptions_prof
  on myia_prescriptions(professional_id, issued_at desc);

-- --------------------------------------------------------------------------
-- 3. Registrar a emissão
--
-- Mesma regra de 0022/0024/0025: o médico escreve por função, não por policy.
-- Aqui isso vale duplamente — a receita é o comprovante de um ato clínico, e
-- um UPDATE livre deixaria reescrever o que foi prescrito depois do fato.
--
-- Idempotente por `memed_uuid`: o evento do front pode chegar duas vezes (o
-- médico reimprime, a aba recarrega), e duplicar receita no prontuário seria
-- pior que ignorar a segunda.
-- --------------------------------------------------------------------------
create or replace function record_prescription(
  p_memed_uuid        text,
  p_memed_id          text,
  p_medical_record_id uuid,
  p_medicamentos      jsonb,
  p_documentos        jsonb
)
returns myia_prescriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prof uuid := auth_professional_id();
  v_comp uuid := auth_company_id();
  v_rec  record;
  v_row  myia_prescriptions;
begin
  if app_role() is distinct from 'professional' or v_prof is null then
    raise exception 'Somente o profissional prescritor registra a receita'
      using errcode = '42501';
  end if;

  if coalesce(trim(p_memed_uuid), '') = '' then
    raise exception 'Receita sem identificador da Memed' using errcode = '22023';
  end if;

  -- O prontuário é opcional (pode-se prescrever fora de um registro), mas se
  -- vier tem de ser do próprio médico — senão a receita apareceria pendurada
  -- no prontuário de outra pessoa.
  if p_medical_record_id is not null then
    select r.id, r.appointment_id into v_rec
      from myia_medical_records r
     where r.id = p_medical_record_id
       and r.professional_id = v_prof
       and r.company_id = v_comp;
    if not found then
      raise exception 'Prontuário não encontrado' using errcode = 'P0002';
    end if;
  end if;

  insert into myia_prescriptions (
    company_id, professional_id, appointment_id, medical_record_id,
    memed_uuid, memed_id, medicamentos, documentos
  ) values (
    v_comp, v_prof, v_rec.appointment_id, p_medical_record_id,
    trim(p_memed_uuid), p_memed_id,
    coalesce(p_medicamentos, '[]'::jsonb), coalesce(p_documentos, '[]'::jsonb)
  )
  on conflict (memed_uuid) do update
    set medicamentos = excluded.medicamentos,
        documentos   = excluded.documentos
  returning * into v_row;

  return v_row;
end;
$$;

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
alter table myia_prescriptions enable row level security;

drop policy if exists prescriptions_owner_all on myia_prescriptions;
create policy prescriptions_owner_all on myia_prescriptions
  for all
  using      (company_id = (select auth_company_id()) and (select app_role()) = 'owner')
  with check (company_id = (select auth_company_id()) and (select app_role()) = 'owner');

drop policy if exists prescriptions_professional_read on myia_prescriptions;
create policy prescriptions_professional_read on myia_prescriptions
  for select using (
    (select app_role()) = 'professional'
    and company_id = (select auth_company_id())
    and professional_id = (select auth_professional_id())
  );

grant select, insert, update, delete on myia_prescriptions
  to anon, authenticated, service_role;
grant execute on function record_prescription(text, text, uuid, jsonb, jsonb)
  to authenticated, service_role;
grant execute on function parse_registro_conselho(text) to authenticated, service_role;

comment on table myia_prescriptions is
  'Comprovante das receitas emitidas na Memed. O documento legal vive lá e é '
  'assinado por eles; aqui fica o vínculo com o prontuário e o resumo do que '
  'foi prescrito.';
