-- Modelos de prontuário (0023).
--
-- Três coisas a proteger, em ordem de gravidade:
--   1. Nenhuma clínica edita o catálogo do sistema — ele é compartilhado, e um
--      modelo alterado por uma apareceria alterado para todas.
--   2. Nenhuma clínica enxerga modelo de outra.
--   3. `content` nunca fica vazio num prontuário que tem texto nas colunas
--      legadas — é o que faz a tela nova continuar mostrando os 1606 registros
--      que já existiam.
--
-- Convenção do runner: qualquer linha retornada é uma falha de asserção.

create temporary table t_falhas (msg text) on commit drop;

create temporary table t on commit drop as
select
  (select id from myia_users where role = 'owner' order by created_at limit 1)  as owner_a,
  (select company_id from myia_users where role = 'owner' order by created_at limit 1) as comp_a,
  (select id from myia_users where role = 'professional'
     and professional_id is not null order by created_at limit 1)               as prof_user,
  (select id from myia_record_templates where company_id is null
     order by name limit 1)                                                     as tpl_sistema;

select 'seed insuficiente: falta owner, profissional ou modelo do sistema'
  where exists (select 1 from t where owner_a is null or comp_a is null
                   or prof_user is null or tpl_sistema is null);

grant select on t to authenticated;
grant insert on t_falhas to authenticated;

-- --------------------------------------------------------------- forma de fields
-- A função de CHECK é a única defesa contra um modelo que renderiza torto.
insert into t_falhas
select 'aceitou fields que não é array' where record_template_fields_ok('{}'::jsonb);
insert into t_falhas
select 'aceitou array vazio' where record_template_fields_ok('[]'::jsonb);
insert into t_falhas
select 'aceitou campo sem label'
  where record_template_fields_ok('[{"key":"a"}]'::jsonb);
insert into t_falhas
select 'aceitou chave com maiúscula/espaço'
  where record_template_fields_ok('[{"key":"Minha Chave","label":"x"}]'::jsonb);
insert into t_falhas
select 'aceitou tipo desconhecido'
  where record_template_fields_ok('[{"key":"a","label":"A","type":"canvas"}]'::jsonb);
insert into t_falhas
select 'aceitou select sem opções'
  where record_template_fields_ok('[{"key":"a","label":"A","type":"select"}]'::jsonb);
insert into t_falhas
select 'aceitou chaves duplicadas'
  where record_template_fields_ok('[{"key":"a","label":"A"},{"key":"a","label":"B"}]'::jsonb);
insert into t_falhas
select 'recusou um modelo válido'
  where not record_template_fields_ok(
    '[{"key":"a","label":"A"},{"key":"b","label":"B","type":"select","options":["x"]}]'::jsonb);

-- ------------------------------------------------------------------- como o dono
do $dono$
declare
  v_t     record;
  v_linhas int;
begin
  select * into v_t from t;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_t.owner_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  -- 1. O catálogo do sistema é LEGÍVEL...
  if not exists (select 1 from myia_record_templates where id = v_t.tpl_sistema) then
    insert into t_falhas values ('dono não enxergou o catálogo do sistema');
  end if;

  -- ...e NÃO é editável. O `using` da policy de escrita exige company_id não
  -- nulo, então o UPDATE não encontra linha: zero linhas, sem erro.
  update myia_record_templates set name = 'SEQUESTRADO' where id = v_t.tpl_sistema;
  get diagnostics v_linhas = row_count;
  if v_linhas > 0 then
    insert into t_falhas values ('dono editou um modelo do catálogo do sistema');
  end if;

  delete from myia_record_templates where id = v_t.tpl_sistema;
  get diagnostics v_linhas = row_count;
  if v_linhas > 0 then
    insert into t_falhas values ('dono apagou um modelo do catálogo do sistema');
  end if;

  -- 2. Criar modelo do SISTEMA (company_id null) é recusado pelo with check.
  begin
    insert into myia_record_templates (company_id, name, fields)
    values (null, 'Falso modelo do sistema', '[{"key":"a","label":"A"}]'::jsonb);
    insert into t_falhas values ('dono criou modelo no catálogo do sistema');
  exception when insufficient_privilege then null;
  end;

  -- 3. Criar modelo PRÓPRIO funciona.
  begin
    insert into myia_record_templates (company_id, name, fields)
    values (v_t.comp_a, 'Modelo de teste da clínica', '[{"key":"a","label":"A"}]'::jsonb);
  exception when others then
    insert into t_falhas values ('dono não conseguiu criar modelo da própria clínica: ' || sqlerrm);
  end;

  -- 4. Criar modelo para OUTRA clínica é recusado.
  begin
    insert into myia_record_templates (company_id, name, fields)
    values (gen_random_uuid(), 'Modelo alheio', '[{"key":"a","label":"A"}]'::jsonb);
    insert into t_falhas values ('dono criou modelo para outra clínica');
  exception when insufficient_privilege or foreign_key_violation then null;
  end;

  -- 4b. Arquivar é o que o editor faz no lugar de apagar. Precisa funcionar,
  --     e precisa TIRAR o modelo do catálogo — que é a consulta que as duas
  --     telas fazem (`archived_at is null`).
  update myia_record_templates
     set archived_at = now()
   where company_id = v_t.comp_a and name = 'Modelo de teste da clínica';
  get diagnostics v_linhas = row_count;
  if v_linhas = 0 then
    insert into t_falhas values ('dono não conseguiu arquivar o próprio modelo');
  end if;
  if exists (
    select 1 from myia_record_templates
     where company_id = v_t.comp_a and name = 'Modelo de teste da clínica'
       and archived_at is null
  ) then
    insert into t_falhas values ('modelo arquivado continuou no catálogo');
  end if;

  execute 'reset role';
  perform set_config('request.jwt.claims', null, true);
end
$dono$;

-- -------------------------------------------------------------- como o médico
do $medico$
declare
  v_t      record;
  v_linhas int;
begin
  select * into v_t from t;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_t.prof_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  -- 5. Lê o catálogo — é do que a tela do prontuário depende para renderizar.
  if not exists (select 1 from myia_record_templates where id = v_t.tpl_sistema) then
    insert into t_falhas values ('médico não enxergou o catálogo do sistema');
  end if;

  -- 6. Não escreve modelo nenhum, nem da própria clínica.
  update myia_record_templates set name = 'MEDICO EDITOU' where company_id = v_t.comp_a;
  get diagnostics v_linhas = row_count;
  if v_linhas > 0 then
    insert into t_falhas values ('médico editou modelo da clínica');
  end if;

  begin
    insert into myia_record_templates (company_id, name, fields)
    values (v_t.comp_a, 'Modelo criado pelo médico', '[{"key":"a","label":"A"}]'::jsonb);
    insert into t_falhas values ('médico criou modelo');
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claims', null, true);
end
$medico$;

-- ------------------------------------------------------------ ponte com o legado
-- 7. Todo prontuário tem content e template — o backfill de 0023 não deixou
--    ninguém para trás.
insert into t_falhas
select 'prontuário sem content ou sem template: ' || count(*)::text
  from myia_medical_records
 where content = '{}'::jsonb or template_id is null
having count(*) > 0;

-- 8. O gatilho copia coluna → content num registro novo.
do $ponte$
declare
  v_appt  record;
  v_id    uuid;
  v_content jsonb;
begin
  select a.id, a.professional_id, a.company_id into v_appt
    from myia_appointments a
    join myia_medical_records r on r.appointment_id = a.id
   limit 1;

  -- Um agendamento sem prontuário; se não houver, reaproveita via update.
  update myia_medical_records
     set anamnesis = 'ANAMNESE NOVA', content = '{}'::jsonb
   where appointment_id = v_appt.id
  returning id, content into v_id, v_content;

  if v_content->>'anamnesis' is distinct from 'ANAMNESE NOVA' then
    insert into t_falhas values
      ('o gatilho não copiou a coluna legada para content: ' || coalesce(v_content::text, 'null'));
  end if;
end
$ponte$;

-- 9. `content` que já tem a chave NÃO é sobrescrito pela coluna legada — é o
--    que garante que um prontuário escrito por modelo sobreviva a um writer
--    antigo que ainda mexa nas colunas.
do $precedencia$
declare
  v_content jsonb;
begin
  update myia_medical_records
     set anamnesis = 'VERSAO COLUNA',
         content = content || '{"anamnesis":"VERSAO CONTENT"}'::jsonb
   where id = (select id from myia_medical_records limit 1)
  returning content into v_content;

  if v_content->>'anamnesis' is distinct from 'VERSAO CONTENT' then
    insert into t_falhas values ('a coluna legada sobrescreveu content');
  end if;
end
$precedencia$;

select msg from t_falhas;
