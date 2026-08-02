-- Escuta assistida (0025).
--
-- A asserção que dá nome a esta suíte: NÃO EXISTE SESSÃO SEM CONSENTIMENTO, e
-- isso é garantido pelo banco, não pela tela. Uma checagem só no front seria
-- contornável pela API — e esta é exatamente a obrigação que não pode depender
-- do cliente.
--
-- Convenção do runner: qualquer linha retornada é uma falha de asserção.

create temporary table t_falhas (msg text) on commit drop;

create temporary table t on commit drop as
select
  u.id              as user_a,
  u.professional_id as prof_a,
  u.company_id      as comp_a,
  (select id from myia_record_templates where id = '7e000000-0000-4000-8000-000000000001') as tpl
from myia_users u
where u.role = 'professional' and u.professional_id is not null
order by u.created_at limit 1;

alter table t add column appt_livre uuid;
alter table t add column appt_alheio uuid;

update t set
  appt_livre = (
    select a.id from myia_appointments a
     where a.professional_id = t.prof_a and a.status <> 'cancelled'
       and not exists (select 1 from myia_medical_records m where m.appointment_id = a.id)
       and not exists (select 1 from myia_listening_sessions s where s.appointment_id = a.id)
     limit 1),
  appt_alheio = (
    select a.id from myia_appointments a where a.professional_id is distinct from t.prof_a limit 1);

select 'seed insuficiente para exercitar a escuta'
  where exists (select 1 from t
                 where user_a is null or appt_livre is null or appt_alheio is null or tpl is null);

grant select on t to authenticated;
grant insert on t_falhas to authenticated;

-- ------------------------------------------------ o esquema não guarda áudio
-- A ausência de coluna de áudio é decisão de produto (LGPD). Se alguém
-- acrescentar uma, que seja com esta asserção falhando na cara — não em
-- silêncio.
insert into t_falhas
select 'myia_listening_sessions ganhou coluna de áudio: ' || column_name
  from information_schema.columns
 where table_name = 'myia_listening_sessions'
   and (column_name ~* 'audio|recording_url|blob|media')
   and column_name !~* 'status';

-- Consentimento é NOT NULL — a garantia mora no schema.
insert into t_falhas
select 'consent_given_at deixou de ser NOT NULL'
  from information_schema.columns
 where table_name = 'myia_listening_sessions' and column_name = 'consent_given_at'
   and is_nullable = 'YES';

do $bateria$
declare
  v_t    record;
  v_sess myia_listening_sessions;
  v_rec  myia_medical_records;
  v_id   uuid;
  v_linhas int;
begin
  select * into v_t from t;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_t.user_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  -- 1. Atendimento de OUTRO médico é inalcançável.
  begin
    perform start_listening_session(v_t.appt_alheio, v_t.tpl, 'verbal', null);
    insert into t_falhas values ('médico abriu escuta em atendimento alheio');
  exception when no_data_found then null;
  end;

  -- 2. Forma de consentimento inventada é recusada.
  begin
    perform start_listening_session(v_t.appt_livre, v_t.tpl, 'presumido', null);
    insert into t_falhas values ('aceitou forma de consentimento inválida');
  exception when invalid_parameter_value then null;
  end;

  -- 3. Abrir a sessão grava o consentimento com hora do servidor.
  v_sess := start_listening_session(v_t.appt_livre, v_t.tpl, 'verbal', null);
  v_id := v_sess.id;
  if v_sess.consent_given_at is null or v_sess.status is distinct from 'recording' then
    insert into t_falhas values ('sessão nasceu sem consentimento ou em estado errado');
  end if;

  -- 4. Reabrir o MESMO atendimento retoma a sessão em vez de duplicar — é o
  --    caso da aba fechada no meio da consulta.
  v_sess := start_listening_session(v_t.appt_livre, v_t.tpl, 'verbal', null);
  if v_sess.id is distinct from v_id then
    insert into t_falhas values ('reabrir criou uma segunda sessão para o mesmo atendimento');
  end if;

  -- 5. A transcrição é gravada pelo caminho previsto.
  v_sess := update_listening_session(v_id, 'drafting', 'Paciente relata dor lombar.', null);
  if v_sess.transcript is distinct from 'Paciente relata dor lombar.' then
    insert into t_falhas values ('a transcrição não foi gravada');
  end if;

  -- 6. UPDATE direto é negado — a transcrição é a única prova de onde o
  --    rascunho veio, e o médico não pode reescrevê-la.
  update myia_listening_sessions set transcript = 'REESCRITO' where id = v_id;
  get diagnostics v_linhas = row_count;
  if v_linhas > 0 then
    insert into t_falhas values ('médico reescreveu a transcrição por UPDATE direto');
  end if;

  -- 7. Concluir gera prontuário com procedência de IA — não 'manual'.
  v_rec := finish_listening_session(v_id, '{"chief_complaint":"Dor lombar"}'::jsonb, 'claude-opus-5');
  if v_rec.source is distinct from 'ai' or v_rec.ai_model is distinct from 'claude-opus-5'
     or v_rec.ai_generated_at is null then
    insert into t_falhas values ('o prontuário da escuta não nasceu com procedência de IA');
  end if;
  if v_rec.review_status is distinct from 'pending' then
    insert into t_falhas values ('rascunho da IA nasceu fora de "aguardando revisão"');
  end if;

  -- 8. Concluir duas vezes é recusado, e a sessão fica terminal.
  begin
    perform finish_listening_session(v_id, '{}'::jsonb, 'claude-opus-5');
    insert into t_falhas values ('a mesma escuta gerou dois prontuários');
  exception when unique_violation then null;
  end;
  begin
    perform update_listening_session(v_id, 'recording', null, null);
    insert into t_falhas values ('sessão concluída voltou a gravar');
  exception when no_data_found then null;
  end;

  -- 9. Sessão de outro profissional é inalcançável para escrita.
  begin
    perform update_listening_session(gen_random_uuid(), 'failed', null, 'x');
    insert into t_falhas values ('escreveu em sessão inexistente/alheia');
  exception when no_data_found then null;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claims', null, true);
end
$bateria$;

select msg from t_falhas;
