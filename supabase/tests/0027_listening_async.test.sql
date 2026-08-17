-- Escuta assíncrona (0027).
--
-- A asserção que dá nome a esta suíte: O WORKER NÃO ESCOLHE EM NOME DE QUEM
-- AGE. As RPCs de 0027 rodam sem usuário autenticado — não há `auth.uid()`,
-- não há `app_role()` — e por isso a tentação é receber `professional_id` e
-- `company_id` por parâmetro. Se fizessem isso, quem alcançasse a chave de
-- service_role escreveria prontuário em qualquer clínica. Elas derivam tudo da
-- própria sessão, que só existe porque um médico autenticado a criou.
--
-- A segunda asserção: MÉDICO NÃO CHAMA FUNÇÃO DE WORKER. São duas barreiras
-- independentes (o EXECUTE revogado e o is_service_role() dentro), e o teste
-- cobre a de dentro, que é a que sobra se alguém reconceder o grant sem pensar.
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

update t set
  appt_livre = (
    select a.id from myia_appointments a
     where a.professional_id = t.prof_a and a.status <> 'cancelled'
       and not exists (select 1 from myia_medical_records m where m.appointment_id = a.id)
       and not exists (select 1 from myia_listening_sessions s where s.appointment_id = a.id)
     limit 1);

select 'seed insuficiente para exercitar a escuta assíncrona'
  where exists (select 1 from t where user_a is null or appt_livre is null or tpl is null);

grant select on t to authenticated;
grant insert on t_falhas to authenticated;

-- ------------------------------------------------- o esquema segue sem áudio
-- 0027 acrescentou `audio_path`, que guarda um CAMINHO. Se alguém transformar
-- isso numa coluna de áudio de verdade, esta asserção falha — é a mesma
-- guarda de 0025, repetida aqui porque 0027 é justamente a migration que
-- passou perto dessa linha.
select 'coluna de áudio apareceu em myia_listening_sessions: ' || column_name
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'myia_listening_sessions'
   and (column_name ~* '(^|_)(audio|recording|blob|media)(_|$)'
        and column_name <> 'audio_path');

-- `audio_path` precisa ser texto. bytea aqui seria o áudio no banco.
select 'audio_path deixou de ser texto: ' || data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'myia_listening_sessions'
   and column_name = 'audio_path' and data_type <> 'text';

-- ------------------------------------------------------ bateria do MÉDICO
do $medico$
declare
  v_t    record;
  v_sess myia_listening_sessions;
begin
  select * into v_t from t;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_t.user_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  v_sess := start_listening_session(v_t.appt_livre, v_t.tpl, 'verbal', null);

  -- 1. Enfileirar sem caminho de áudio é recusado: uma sessão 'queued' sem
  --    arquivo seria reivindicada pelo worker e falharia lá, longe da causa.
  begin
    perform enqueue_listening_session(v_sess.id, '   ');
    insert into t_falhas values ('aceitou enfileirar sem caminho de áudio');
  exception when invalid_parameter_value then null;
  end;

  -- 2. Enfileirar marca 'queued' e guarda o caminho.
  v_sess := enqueue_listening_session(v_sess.id, '/dados/escuta/x.webm');
  if v_sess.status is distinct from 'queued' or v_sess.audio_path is null then
    insert into t_falhas values ('enfileirar não deixou a sessão pronta para o worker');
  end if;

  -- 3. O médico NÃO reivindica sessões.
  begin
    perform claim_listening_sessions('worker-falso', 1);
    insert into t_falhas values ('médico conseguiu reivindicar sessão');
  exception when insufficient_privilege then null;
  end;

  -- 4. O médico NÃO escreve estado pela porta do worker — senão poderia
  --    marcar 'failed' numa sessão alheia, ou reescrever a transcrição, que
  --    é a fonte de auditoria do rascunho.
  begin
    perform worker_update_listening_session(v_sess.id, 'drafting', 'texto forjado', null);
    insert into t_falhas values ('médico escreveu pela porta do worker');
  exception when insufficient_privilege then null;
  end;

  -- 5. O médico NÃO cria prontuário pela porta do worker.
  begin
    perform worker_finish_listening_session(v_sess.id, '{"x":"y"}'::jsonb, 'modelo');
    insert into t_falhas values ('médico criou prontuário pela porta do worker');
  exception when insufficient_privilege then null;
  end;

  -- 6. Nem varre áudio, nem revive sessão.
  begin
    perform reap_listening_sessions(1800, 3);
    insert into t_falhas values ('médico rodou o reaper');
  exception when insufficient_privilege then null;
  end;
  begin
    perform sweep_listening_audio(6);
    insert into t_falhas values ('médico rodou a varredura de áudio');
  exception when insufficient_privilege then null;
  end;

  -- 7. A transcrição continua fora do alcance de UPDATE direto (RLS de 0025).
  begin
    update myia_listening_sessions set transcript = 'reescrito' where id = v_sess.id;
    if found then
      insert into t_falhas values ('médico reescreveu a transcrição por UPDATE direto');
    end if;
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', null, true);
  execute 'reset role';
end;
$medico$;

-- ------------------------------------------------------ bateria do WORKER
-- O runner conecta como `postgres`, não como `service_role`, então a guarda
-- precisa ser satisfeita do mesmo jeito que em produção: pelo claim que o
-- PostgREST põe na conexão quando a chamada usa a chave de serviço. Simular
-- por aqui é o que torna o teste fiel — trocar a guarda por algo que o
-- `postgres` satisfizesse tornaria o teste verde e a produção aberta.
do $worker$
declare
  v_t     record;
  v_sess  myia_listening_sessions;
  v_rec   myia_medical_records;
  v_lote  myia_listening_sessions;
  v_n     int;
begin
  select * into v_t from t;
  perform set_config('request.jwt.claims',
    json_build_object('role', 'service_role')::text, true);

  select * into v_sess from myia_listening_sessions
   where appointment_id = v_t.appt_livre order by created_at desc limit 1;

  if v_sess.status is distinct from 'queued' then
    insert into t_falhas values ('a sessão não chegou como queued para o worker');
    return;
  end if;

  -- 8. Reivindicar move para 'transcribing', carimba dono e conta tentativa.
  select * into v_lote from claim_listening_sessions('worker-1', 5);
  if v_lote.id is distinct from v_sess.id
     or v_lote.status is distinct from 'transcribing'
     or v_lote.claimed_by is distinct from 'worker-1'
     or v_lote.attempts < 1 then
    insert into t_falhas values ('claim não reivindicou corretamente');
  end if;

  -- 9. Reivindicar de novo NÃO devolve a mesma sessão: sem isso, dois workers
  --    transcreveriam a mesma consulta e o segundo criaria prontuário duplo.
  select count(*) into v_n from claim_listening_sessions('worker-2', 5)
   where id = v_sess.id;
  if v_n > 0 then
    insert into t_falhas values ('a mesma sessão foi reivindicada duas vezes');
  end if;

  -- 10. O worker grava a transcrição e avança o estado.
  v_sess := worker_update_listening_session(v_sess.id, 'drafting', 'Paciente relata dor.', null);
  if v_sess.status is distinct from 'drafting' or v_sess.transcript is null then
    insert into t_falhas values ('worker não gravou transcrição/estado');
  end if;

  -- 11. 'done' NÃO entra pela porta de estado: prontuário nasce só no finish.
  --     Sem esta trava, uma sessão viraria terminal sem prontuário e a
  --     consulta estaria perdida com aparência de sucesso.
  begin
    perform worker_update_listening_session(v_sess.id, 'done', null, null);
    insert into t_falhas values ('worker marcou done sem criar prontuário');
  exception when invalid_parameter_value then null;
  end;

  -- 12. Concluir cria o prontuário com procedência de IA e o tenant vindo da
  --     SESSÃO — é a asserção central desta suíte.
  v_rec := worker_finish_listening_session(v_sess.id, '{"chief_complaint":"dor"}'::jsonb, 'whisper+gpt-oss');
  if v_rec.source is distinct from 'ai'
     or v_rec.review_status is distinct from 'pending'
     or v_rec.professional_id is distinct from v_t.prof_a
     or v_rec.company_id is distinct from v_t.comp_a then
    insert into t_falhas values ('prontuário do worker saiu com procedência ou tenant errado');
  end if;

  -- 13. Concluir apagou a referência ao áudio.
  select * into v_sess from myia_listening_sessions where id = v_sess.id;
  if v_sess.status is distinct from 'done' or v_sess.audio_path is not null then
    insert into t_falhas values ('sessão concluída não limpou audio_path');
  end if;

  -- 14. Concluída é terminal, inclusive para o worker.
  begin
    perform worker_finish_listening_session(v_sess.id, '{"a":"b"}'::jsonb, 'x');
    insert into t_falhas values ('worker concluiu a mesma escuta duas vezes');
  exception when unique_violation then null;
  end;
  begin
    perform worker_update_listening_session(v_sess.id, 'queued', null, null);
    insert into t_falhas values ('worker reabriu escuta concluída');
  exception when no_data_found then null;
  end;
end;
$worker$;

-- ------------------------------------------------------------------ veredito
select msg from t_falhas;
