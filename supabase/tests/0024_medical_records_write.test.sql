-- Criação e edição de prontuário pelo profissional (0024).
--
-- O que esta suíte protege:
--   · ninguém abre prontuário no atendimento de outro médico;
--   · prontuário assinado não muda mais — nem por edição, que é o caminho que
--     0022 não cobria;
--   · salvar MESCLA: conteúdo fora do modelo atual sobrevive, e conteúdo
--     apagado não ressuscita pelo gatilho de 0023.
--
-- Convenção do runner: qualquer linha retornada é uma falha de asserção.

create temporary table t_falhas (msg text) on commit drop;

create temporary table t on commit drop as
select
  u.id                                                   as user_a,
  u.professional_id                                      as prof_a,
  u.company_id                                           as comp_a,
  (select id from myia_record_templates
    where id = '7e000000-0000-4000-8000-000000000001')   as tpl_soap,
  (select id from myia_record_templates
    where id = '7e000000-0000-4000-8000-000000000010')   as tpl_cardio
from myia_users u
where u.role = 'professional' and u.professional_id is not null
order by u.created_at limit 1;

alter table t add column appt_livre uuid;
alter table t add column appt_alheio uuid;

update t set
  -- Atendimento do próprio médico que ainda não tem prontuário.
  appt_livre = (
    select a.id from myia_appointments a
     where a.professional_id = t.prof_a and a.status <> 'cancelled'
       and not exists (select 1 from myia_medical_records m where m.appointment_id = a.id)
     limit 1),
  -- Atendimento de OUTRO profissional.
  appt_alheio = (
    select a.id from myia_appointments a
     where a.professional_id is distinct from t.prof_a limit 1);

select 'seed insuficiente para exercitar criação de prontuário'
  where exists (select 1 from t
                 where user_a is null or appt_livre is null or appt_alheio is null
                    or tpl_soap is null or tpl_cardio is null);

grant select on t to authenticated;
grant insert on t_falhas to authenticated;

do $bateria$
declare
  v_t     record;
  v_rec   myia_medical_records;
  v_novo  uuid;
  v_linhas int;
begin
  select * into v_t from t;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_t.user_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  -- 1. Criar no atendimento de OUTRO médico é recusado.
  begin
    perform create_medical_record(v_t.appt_alheio, v_t.tpl_soap);
    insert into t_falhas values ('médico abriu prontuário em atendimento alheio');
  exception when no_data_found then null;
  end;

  -- 2. Criar com modelo de outra clínica (id inexistente) é recusado.
  begin
    perform create_medical_record(v_t.appt_livre, gen_random_uuid());
    insert into t_falhas values ('aceitou modelo indisponível');
  exception when no_data_found then null;
  end;

  -- 3. Criar no próprio atendimento funciona, com o modelo escolhido.
  v_rec := create_medical_record(v_t.appt_livre, v_t.tpl_cardio);
  v_novo := v_rec.id;
  if v_rec.template_id is distinct from v_t.tpl_cardio then
    insert into t_falhas values ('o modelo escolhido não foi gravado');
  end if;
  if v_rec.review_status is distinct from 'pending' or v_rec.source is distinct from 'manual' then
    insert into t_falhas values ('prontuário novo nasceu em estado errado');
  end if;

  -- 4. Um por atendimento.
  begin
    perform create_medical_record(v_t.appt_livre, v_t.tpl_cardio);
    insert into t_falhas values ('criou dois prontuários para o mesmo atendimento');
  exception when unique_violation then null;
  end;

  -- 5. Salvar grava conteúdo E espelha nas colunas legadas — é o espelho que
  --    impede o gatilho de 0023 de trazer texto velho de volta.
  v_rec := save_medical_record(v_novo,
    '{"chief_complaint":"Dor torácica aos esforços","risk_factors":"HAS, tabagismo"}'::jsonb, null);
  if v_rec.content->>'risk_factors' is distinct from 'HAS, tabagismo' then
    insert into t_falhas values ('campo do modelo não foi gravado');
  end if;
  if v_rec.chief_complaint is distinct from 'Dor torácica aos esforços' then
    insert into t_falhas values ('coluna legada não acompanhou o content');
  end if;

  -- 6. Salvar MESCLA: o que não veio no formulário continua lá.
  v_rec := save_medical_record(v_novo, '{"plan":"Solicitado ECG"}'::jsonb, null);
  if v_rec.content->>'risk_factors' is distinct from 'HAS, tabagismo' then
    insert into t_falhas values ('salvar apagou conteúdo fora do formulário');
  end if;

  -- 7. Apagar um campo (string vazia) FICA apagado — sem ressurreição pelo
  --    gatilho a partir da coluna legada.
  v_rec := save_medical_record(v_novo, '{"chief_complaint":""}'::jsonb, null);
  if coalesce(v_rec.content->>'chief_complaint', 'nulo') <> '' then
    insert into t_falhas values
      ('campo apagado voltou: ' || coalesce(v_rec.content->>'chief_complaint', 'nulo'));
  end if;

  -- 8. Trocar de modelo é permitido enquanto não assinado.
  v_rec := save_medical_record(v_novo, '{}'::jsonb, v_t.tpl_soap);
  if v_rec.template_id is distinct from v_t.tpl_soap then
    insert into t_falhas values ('não foi possível trocar o modelo');
  end if;

  -- 9. Editar um rascunho REVISADO o devolve para pendente — o "revisado" se
  --    referia ao texto anterior.
  perform sign_medical_record(v_novo, 'review');
  v_rec := save_medical_record(v_novo, '{"plan":"Ajustado"}'::jsonb, null);
  if v_rec.review_status is distinct from 'pending' or v_rec.reviewed_at is not null then
    insert into t_falhas values ('editar um revisado não o devolveu para pendente');
  end if;

  -- 10. ASSINADO NÃO MUDA MAIS. É a asserção central desta migration.
  perform sign_medical_record(v_novo, 'sign');
  begin
    perform save_medical_record(v_novo, '{"plan":"Alterado depois de assinar"}'::jsonb, null);
    insert into t_falhas values ('prontuário assinado foi alterado');
  exception when check_violation then null;
  end;

  -- 11. E nem por UPDATE direto — a policy de escrita continua não existindo.
  update myia_medical_records set anamnesis = 'INJETADO' where id = v_novo;
  get diagnostics v_linhas = row_count;
  if v_linhas > 0 then
    insert into t_falhas values ('UPDATE direto no prontuário funcionou');
  end if;

  -- 12. Salvar prontuário de outro médico é inalcançável.
  begin
    perform save_medical_record(
      (select id from myia_medical_records where professional_id is distinct from v_t.prof_a limit 1),
      '{"plan":"x"}'::jsonb, null);
    insert into t_falhas values ('médico editou prontuário de outro profissional');
  exception when no_data_found then null;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claims', null, true);
end
$bateria$;

select msg from t_falhas;
