-- Modelos de prontuário.
--
-- Até aqui o prontuário tinha CINCO campos fixos em coluna (queixa, anamnese,
-- exame físico, hipótese, conduta). Isso é o SOAP de uma consulta clínica e não
-- serve para o resto: uma consulta de pré-natal quer idade gestacional e altura
-- uterina; uma avaliação dermatológica quer descrição da lesão e dermatoscopia.
-- Acrescentar coluna por especialidade não escala — a tabela viraria um mural de
-- campos nulos.
--
-- O modelo passa a ser DADO: um template descreve seus campos, e o prontuário
-- guarda os valores num jsonb com as chaves do template.

-- --------------------------------------------------------------------------
-- Validação da forma de `fields`
--
-- Um CHECK não aceita subconsulta, e a validação precisa percorrer o array.
-- Daí a função imutável — `immutable` é exigência do CHECK, e é honesta aqui:
-- a saída depende só do argumento.
-- --------------------------------------------------------------------------
create or replace function record_template_fields_ok(p_fields jsonb)
returns boolean
language sql
immutable
as $$
  select
    jsonb_typeof(p_fields) = 'array'
    -- Ao menos um campo: template vazio renderiza um prontuário em branco e
    -- ninguém descobre por quê.
    and jsonb_array_length(p_fields) between 1 and 40
    and not exists (
      select 1 from jsonb_array_elements(p_fields) f
      where jsonb_typeof(f) <> 'object'
         or coalesce(f->>'key', '')   = ''
         or coalesce(f->>'label', '') = ''
         -- A chave vira nome de propriedade no jsonb do prontuário e id no
         -- formulário; restringir agora evita ter de escapar depois.
         or f->>'key' !~ '^[a-z][a-z0-9_]{0,39}$'
         or coalesce(f->>'type', 'textarea') not in ('text', 'textarea', 'select')
         -- 'select' sem opções é um campo que não dá para preencher.
         or (f->>'type' = 'select' and coalesce(jsonb_array_length(
              case when jsonb_typeof(f->'options') = 'array' then f->'options' else '[]'::jsonb end
            ), 0) = 0)
    )
    -- Chaves repetidas: a segunda sobrescreveria a primeira no jsonb, calada.
    and (
      select count(distinct f->>'key') = jsonb_array_length(p_fields)
      from jsonb_array_elements(p_fields) f
    );
$$;

create table if not exists myia_record_templates (
  id uuid primary key default gen_random_uuid(),

  -- NULL = catálogo do sistema, visível para todas as clínicas e imutável por
  -- elas. Preenchido = modelo próprio da clínica.
  company_id uuid references myia_companies(id) on delete cascade,

  name        text not null,
  specialty   text,
  description text,

  -- [{key, label, type, icon?, placeholder?, hint?, options?}]
  fields jsonb not null,

  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint myia_record_templates_fields_shape check (record_template_fields_ok(fields)),
  constraint myia_record_templates_name_not_blank check (length(trim(name)) > 0)
);

-- Coluna gerada em vez de booleano solto: `is_system` não pode divergir de
-- `company_id is null`, e um booleano que alguém pode gravar errado seria
-- exatamente a divergência que abre modelo do sistema para edição.
alter table myia_record_templates
  drop column if exists is_system;
alter table myia_record_templates
  add column is_system boolean generated always as (company_id is null) stored;

-- Nome único por clínica (e no catálogo do sistema). Índice parcial porque
-- `unique (company_id, name)` deixaria repetir nome entre modelos do sistema —
-- NULL nunca é igual a NULL.
create unique index if not exists uq_record_templates_company_name
  on myia_record_templates(company_id, lower(name)) where company_id is not null;
create unique index if not exists uq_record_templates_system_name
  on myia_record_templates(lower(name)) where company_id is null;

create index if not exists idx_record_templates_company
  on myia_record_templates(company_id) where archived_at is null;

-- --------------------------------------------------------------------------
-- O prontuário passa a apontar para um modelo e a guardar os valores em jsonb.
-- --------------------------------------------------------------------------
alter table myia_medical_records
  add column if not exists template_id uuid references myia_record_templates(id) on delete set null,
  add column if not exists content jsonb not null default '{}'::jsonb;

alter table myia_medical_records
  drop constraint if exists myia_medical_records_content_object;
alter table myia_medical_records
  add constraint myia_medical_records_content_object
  check (jsonb_typeof(content) = 'object');

create index if not exists idx_medical_records_template
  on myia_medical_records(template_id);

-- --------------------------------------------------------------------------
-- CATÁLOGO DO SISTEMA
--
-- Vai na migration, e não num seed de dev, porque é PRODUTO: um ambiente novo
-- sem estes modelos não tem o recurso. Ids fixos + `on conflict do update`
-- tornam a migration reexecutável e permitem corrigir um modelo depois sem
-- criar duplicata.
-- --------------------------------------------------------------------------
insert into myia_record_templates (id, company_id, name, specialty, description, fields) values

-- As chaves dos cinco campos do SOAP são IGUAIS aos nomes das colunas legadas.
-- Não é coincidência: é o que deixa o gatilho abaixo copiar coluna → content
-- sem tabela de-para.
('7e000000-0000-4000-8000-000000000001', null,
 'Consulta clínica (SOAP)', 'Clínica Geral',
 'Modelo padrão de consulta: queixa, anamnese, exame físico, hipótese e conduta.',
 '[
   {"key":"chief_complaint","label":"Queixa principal","type":"textarea","icon":"complaint","highlight":true,"hint":"O motivo da consulta, nas palavras do paciente."},
   {"key":"anamnesis","label":"Anamnese","type":"textarea","icon":"file"},
   {"key":"physical_exam","label":"Exame físico","type":"textarea","icon":"stethoscope"},
   {"key":"assessment","label":"Hipótese diagnóstica","type":"textarea","icon":"activity"},
   {"key":"plan","label":"Conduta","type":"textarea","icon":"clipboard"}
 ]'::jsonb),

('7e000000-0000-4000-8000-000000000002', null,
 'Retorno / evolução', 'Clínica Geral',
 'Consulta de acompanhamento: o que mudou desde a última vez.',
 '[
   {"key":"chief_complaint","label":"Motivo do retorno","type":"textarea","icon":"complaint","highlight":true},
   {"key":"evolution","label":"Evolução desde a última consulta","type":"textarea","icon":"activity"},
   {"key":"exams_review","label":"Exames trazidos","type":"textarea","icon":"file"},
   {"key":"adherence","label":"Adesão ao tratamento","type":"select","icon":"check",
    "options":["Boa","Parcial","Ruim","Não se aplica"]},
   {"key":"plan","label":"Conduta","type":"textarea","icon":"clipboard"}
 ]'::jsonb),

('7e000000-0000-4000-8000-000000000003', null,
 'Primeira consulta', 'Clínica Geral',
 'Avaliação inicial, com antecedentes e hábitos.',
 '[
   {"key":"chief_complaint","label":"Queixa principal","type":"textarea","icon":"complaint","highlight":true},
   {"key":"anamnesis","label":"História da doença atual","type":"textarea","icon":"file"},
   {"key":"past_history","label":"Antecedentes pessoais","type":"textarea","icon":"history"},
   {"key":"family_history","label":"Antecedentes familiares","type":"textarea","icon":"users"},
   {"key":"medications","label":"Medicações em uso","type":"textarea","icon":"pill"},
   {"key":"allergies","label":"Alergias","type":"textarea","icon":"alert"},
   {"key":"habits","label":"Hábitos de vida","type":"textarea","icon":"heart"},
   {"key":"physical_exam","label":"Exame físico","type":"textarea","icon":"stethoscope"},
   {"key":"assessment","label":"Hipótese diagnóstica","type":"textarea","icon":"activity"},
   {"key":"plan","label":"Conduta","type":"textarea","icon":"clipboard"}
 ]'::jsonb),

('7e000000-0000-4000-8000-000000000010', null,
 'Consulta cardiológica', 'Cardiologia',
 'Avaliação cardiovascular com risco e exames complementares.',
 '[
   {"key":"chief_complaint","label":"Queixa principal","type":"textarea","icon":"complaint","highlight":true},
   {"key":"anamnesis","label":"História cardiovascular","type":"textarea","icon":"heart"},
   {"key":"risk_factors","label":"Fatores de risco","type":"textarea","icon":"alert",
    "hint":"HAS, DM, dislipidemia, tabagismo, histórico familiar."},
   {"key":"blood_pressure","label":"Pressão arterial","type":"text","icon":"activity","placeholder":"120x80 mmHg"},
   {"key":"heart_rate","label":"Frequência cardíaca","type":"text","icon":"heart","placeholder":"72 bpm"},
   {"key":"physical_exam","label":"Exame cardiovascular","type":"textarea","icon":"stethoscope"},
   {"key":"complementary","label":"Exames complementares","type":"textarea","icon":"file",
    "hint":"ECG, ecocardiograma, teste ergométrico."},
   {"key":"assessment","label":"Hipótese diagnóstica","type":"textarea","icon":"activity"},
   {"key":"plan","label":"Conduta","type":"textarea","icon":"clipboard"}
 ]'::jsonb),

('7e000000-0000-4000-8000-000000000020', null,
 'Consulta pediátrica', 'Pediatria',
 'Puericultura e consulta pediátrica, com crescimento e vacinas.',
 '[
   {"key":"chief_complaint","label":"Queixa principal","type":"textarea","icon":"complaint","highlight":true},
   {"key":"anamnesis","label":"História da doença atual","type":"textarea","icon":"file"},
   {"key":"weight","label":"Peso","type":"text","icon":"activity","placeholder":"kg"},
   {"key":"height","label":"Estatura","type":"text","icon":"activity","placeholder":"cm"},
   {"key":"development","label":"Desenvolvimento neuropsicomotor","type":"textarea","icon":"heart"},
   {"key":"vaccines","label":"Vacinação","type":"select","icon":"check",
    "options":["Em dia","Atrasada","A verificar"]},
   {"key":"feeding","label":"Alimentação","type":"textarea","icon":"heart"},
   {"key":"physical_exam","label":"Exame físico","type":"textarea","icon":"stethoscope"},
   {"key":"assessment","label":"Hipótese diagnóstica","type":"textarea","icon":"activity"},
   {"key":"plan","label":"Conduta e orientações","type":"textarea","icon":"clipboard"}
 ]'::jsonb),

('7e000000-0000-4000-8000-000000000030', null,
 'Consulta ginecológica', 'Ginecologia',
 'Avaliação ginecológica com história menstrual e rastreio.',
 '[
   {"key":"chief_complaint","label":"Queixa principal","type":"textarea","icon":"complaint","highlight":true},
   {"key":"menstrual_history","label":"História menstrual","type":"textarea","icon":"history",
    "hint":"Menarca, ciclo, DUM."},
   {"key":"obstetric_history","label":"História obstétrica","type":"text","icon":"users","placeholder":"G_ P_ A_"},
   {"key":"contraception","label":"Contracepção","type":"textarea","icon":"pill"},
   {"key":"screening","label":"Rastreio","type":"textarea","icon":"file",
    "hint":"Citologia, mamografia, densitometria — data e resultado."},
   {"key":"physical_exam","label":"Exame físico e ginecológico","type":"textarea","icon":"stethoscope"},
   {"key":"assessment","label":"Hipótese diagnóstica","type":"textarea","icon":"activity"},
   {"key":"plan","label":"Conduta","type":"textarea","icon":"clipboard"}
 ]'::jsonb),

('7e000000-0000-4000-8000-000000000031', null,
 'Pré-natal', 'Ginecologia',
 'Consulta de pré-natal, uma por visita.',
 '[
   {"key":"gestational_age","label":"Idade gestacional","type":"text","icon":"history","placeholder":"__ semanas"},
   {"key":"complaints","label":"Queixas da gestação","type":"textarea","icon":"complaint","highlight":true},
   {"key":"blood_pressure","label":"Pressão arterial","type":"text","icon":"activity","placeholder":"120x80 mmHg"},
   {"key":"weight","label":"Peso","type":"text","icon":"activity","placeholder":"kg"},
   {"key":"uterine_height","label":"Altura uterina","type":"text","icon":"activity","placeholder":"cm"},
   {"key":"fetal_heartbeat","label":"Batimentos cardiofetais","type":"text","icon":"heart","placeholder":"bpm"},
   {"key":"fetal_movement","label":"Movimentação fetal","type":"select","icon":"check",
    "options":["Presente","Ausente","Não avaliada"]},
   {"key":"exams","label":"Exames e sorologias","type":"textarea","icon":"file"},
   {"key":"plan","label":"Conduta e retorno","type":"textarea","icon":"clipboard"}
 ]'::jsonb),

('7e000000-0000-4000-8000-000000000040', null,
 'Avaliação dermatológica', 'Dermatologia',
 'Lesões de pele, com descrição e dermatoscopia.',
 '[
   {"key":"chief_complaint","label":"Queixa principal","type":"textarea","icon":"complaint","highlight":true},
   {"key":"lesion_time","label":"Tempo de evolução","type":"text","icon":"history"},
   {"key":"lesion_description","label":"Descrição da lesão","type":"textarea","icon":"file",
    "hint":"Tipo, cor, bordas, tamanho e localização."},
   {"key":"dermatoscopy","label":"Dermatoscopia","type":"textarea","icon":"stethoscope"},
   {"key":"phototype","label":"Fototipo (Fitzpatrick)","type":"select","icon":"activity",
    "options":["I","II","III","IV","V","VI"]},
   {"key":"assessment","label":"Hipótese diagnóstica","type":"textarea","icon":"activity"},
   {"key":"plan","label":"Conduta","type":"textarea","icon":"clipboard"}
 ]'::jsonb),

('7e000000-0000-4000-8000-000000000050', null,
 'Avaliação ortopédica', 'Ortopedia',
 'Queixa musculoesquelética, com exame do segmento e imagem.',
 '[
   {"key":"chief_complaint","label":"Queixa principal","type":"textarea","icon":"complaint","highlight":true},
   {"key":"mechanism","label":"Mecanismo de trauma / início","type":"textarea","icon":"history"},
   {"key":"pain_scale","label":"Dor (EVA 0–10)","type":"select","icon":"alert",
    "options":["0","1","2","3","4","5","6","7","8","9","10"]},
   {"key":"segment_exam","label":"Exame do segmento","type":"textarea","icon":"stethoscope",
    "hint":"Inspeção, palpação, amplitude de movimento, testes especiais."},
   {"key":"imaging","label":"Exames de imagem","type":"textarea","icon":"file"},
   {"key":"assessment","label":"Hipótese diagnóstica","type":"textarea","icon":"activity"},
   {"key":"plan","label":"Conduta","type":"textarea","icon":"clipboard"}
 ]'::jsonb),

('7e000000-0000-4000-8000-000000000060', null,
 'Teleconsulta', 'Clínica Geral',
 'Atendimento a distância, com o registro que a modalidade exige.',
 '[
   {"key":"chief_complaint","label":"Queixa principal","type":"textarea","icon":"complaint","highlight":true},
   {"key":"anamnesis","label":"Anamnese","type":"textarea","icon":"file"},
   {"key":"remote_assessment","label":"Avaliação possível a distância","type":"textarea","icon":"stethoscope",
    "hint":"O que foi observado por vídeo e o que ficou limitado."},
   {"key":"assessment","label":"Hipótese diagnóstica","type":"textarea","icon":"activity"},
   {"key":"plan","label":"Conduta","type":"textarea","icon":"clipboard"},
   {"key":"in_person_needed","label":"Necessita consulta presencial","type":"select","icon":"alert",
    "options":["Não","Sim — eletiva","Sim — com urgência"]}
 ]'::jsonb),

('7e000000-0000-4000-8000-000000000070', null,
 'Registro livre', null,
 'Um único campo de texto, para quando nenhum modelo serve.',
 '[
   {"key":"notes","label":"Registro","type":"textarea","icon":"file"}
 ]'::jsonb)

on conflict (id) do update set
  name        = excluded.name,
  specialty   = excluded.specialty,
  description = excluded.description,
  fields      = excluded.fields,
  updated_at  = now();

-- --------------------------------------------------------------------------
-- Ponte com as cinco colunas legadas
--
-- Elas CONTINUAM existindo e continuam sendo escritas pelo seed e por quem
-- gerar o rascunho de IA. O gatilho copia coluna → `content` quando a chave
-- ainda não está lá, e é isso que faz a tela nova ler tudo por um caminho só.
--
-- A direção é de mão única de propósito. Espelhar `content` de volta para as
-- colunas criaria duas fontes de verdade para os mesmos cinco campos, e a
-- pergunta "qual vale?" não teria resposta boa.
-- --------------------------------------------------------------------------
create or replace function medical_record_fill_content()
returns trigger
language plpgsql
as $$
declare
  v_legado jsonb;
begin
  v_legado := jsonb_strip_nulls(jsonb_build_object(
    'chief_complaint', new.chief_complaint,
    'anamnesis',       new.anamnesis,
    'physical_exam',   new.physical_exam,
    'assessment',      new.assessment,
    'plan',            new.plan
  ));

  -- `||` com o legado À ESQUERDA: o que já está em `content` vence. Um
  -- prontuário escrito por template nunca é sobrescrito pelo conteúdo das
  -- colunas antigas.
  new.content := v_legado || coalesce(new.content, '{}'::jsonb);

  if new.template_id is null then
    new.template_id := '7e000000-0000-4000-8000-000000000001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_medical_record_fill_content on myia_medical_records;
create trigger trg_medical_record_fill_content
  before insert or update on myia_medical_records
  for each row execute function medical_record_fill_content();

-- Backfill dos prontuários que já existem. Um UPDATE no-op dispara o gatilho
-- acima e preenche content/template_id com a mesma regra do caminho novo — sem
-- repetir a lógica em SQL solto, que é onde as duas versões divergiriam.
update myia_medical_records set updated_at = updated_at where content = '{}'::jsonb;

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
alter table myia_record_templates enable row level security;

-- Leitura: catálogo do sistema + os modelos da própria clínica. Vale para os
-- dois papéis — o médico precisa ler o modelo para a tela renderizar o
-- prontuário dele.
drop policy if exists record_templates_read on myia_record_templates;
create policy record_templates_read on myia_record_templates
  for select using (
    company_id is null
    or company_id = (select auth_company_id())
  );

-- Escrita: só o dono, só na própria clínica. O `with check` sobre company_id
-- não nulo é o que impede alguém de criar ou alterar modelo do CATÁLOGO DO
-- SISTEMA — que, sem isso, seria editável por qualquer clínica para todas as
-- outras.
drop policy if exists record_templates_owner_write on myia_record_templates;
create policy record_templates_owner_write on myia_record_templates
  for all
  using      (company_id is not null and company_id = (select auth_company_id())
              and (select app_role()) = 'owner')
  with check (company_id is not null and company_id = (select auth_company_id())
              and (select app_role()) = 'owner');

grant select, insert, update, delete on myia_record_templates
  to anon, authenticated, service_role;
grant execute on function record_template_fields_ok(jsonb) to anon, authenticated, service_role;
