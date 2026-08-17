-- Fronteira de escrita do médico sobre o prontuário (0022).
--
-- O que esta suíte protege NÃO é o caminho feliz — esse é visível na tela. É o
-- que a assinatura valeria zero sem: que o médico não consiga reescrever o
-- texto clínico, nem tocar no prontuário de outro médico, nem desassinar.
--
-- Convenção do runner: qualquer linha retornada é uma falha de asserção. Como
-- boa parte das asserções aqui é "isto deveria levantar exceção", elas moram em
-- blocos plpgsql e depositam o texto da falha em `t_falhas`, lido no fim. O
-- alternativo — deixar a exceção escapar — abortaria a suíte no primeiro erro e
-- esconderia os casos seguintes.
--
-- Roda em transação com rollback: nada abaixo persiste.

create temporary table t_falhas (msg text) on commit drop;

-- Um médico e dois prontuários: um dele, um de outro profissional.
create temporary table t on commit drop as
select
  (select id from myia_users where role = 'professional'
     and professional_id is not null order by created_at limit 1)      as user_a,
  (select professional_id from myia_users where role = 'professional'
     and professional_id is not null order by created_at limit 1)      as prof_a;

alter table t add column rec_a uuid;
alter table t add column rec_outro uuid;

update t set
  rec_a = (select id from myia_medical_records
            where professional_id = t.prof_a and review_status = 'pending' limit 1),
  rec_outro = (select id from myia_medical_records
                where professional_id is distinct from t.prof_a limit 1);

select 'seed insuficiente: falta médico ou prontuário pendente para exercitar'
  where exists (select 1 from t where user_a is null or rec_a is null or rec_outro is null);

-- Texto original, para provar no fim que revisar/assinar não encostou nele.
create temporary table t_antes on commit drop as
  select id, anamnesis, assessment, plan from myia_medical_records
   where id = (select rec_a from t);

-- As temporárias nascem do dono da conexão; sem estes grants, o `set role`
-- abaixo torna as próprias fixtures ilegíveis ("permission denied for table t")
-- e a suíte morre antes de exercitar qualquer coisa.
grant select on t to authenticated;
grant insert on t_falhas to authenticated;

-- --------------------------------------------------------------------------
-- Tudo o que segue roda COMO O MÉDICO.
--
-- `set_config` em vez do `set local role` literal de 0009 porque o `sub` sai de
-- uma consulta, e `set local` só aceita constante. O `set role` fica dentro do
-- bloco para valer durante toda a bateria.
-- --------------------------------------------------------------------------
do $bateria$
declare
  v_t     record;
  v_rec   myia_medical_records;
  v_linhas int;
begin
  select * into v_t from t;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_t.user_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  -- 1. UPDATE direto do texto clínico é NEGADO.
  --    Sem policy de update para o papel professional, o RLS não encontra linha
  --    para atualizar: zero linhas, sem erro. Por isso a asserção conta linhas
  --    em vez de esperar exceção.
  update myia_medical_records
     set anamnesis = 'TEXTO INJETADO PELO CLIENTE'
   where id = v_t.rec_a;
  get diagnostics v_linhas = row_count;
  if v_linhas > 0 then
    insert into t_falhas values ('médico reescreveu a anamnese por UPDATE direto');
  end if;

  -- 2. A RPC é a porta permitida: revisar o próprio prontuário funciona.
  v_rec := sign_medical_record(v_t.rec_a, 'review');
  if v_rec.review_status is distinct from 'reviewed' then
    insert into t_falhas values ('a RPC não marcou como revisado: ' || coalesce(v_rec.review_status, 'null'));
  end if;
  if v_rec.reviewed_at is null then
    insert into t_falhas values ('revisão não carimbou reviewed_at');
  end if;

  -- 3. Revisar de novo é recusado — o estado já saiu de 'pending'.
  begin
    perform sign_medical_record(v_t.rec_a, 'review');
    insert into t_falhas values ('revisar duas vezes foi aceito');
  exception when check_violation then null;
  end;

  -- 4. Assinar funciona e carimba signed_at.
  v_rec := sign_medical_record(v_t.rec_a, 'sign');
  if v_rec.review_status is distinct from 'signed' or v_rec.signed_at is null then
    insert into t_falhas values ('a assinatura não gravou signed/signed_at');
  end if;

  -- 5. Assinado é TERMINAL: nem re-assinar, nem voltar a revisado.
  begin
    perform sign_medical_record(v_t.rec_a, 'sign');
    insert into t_falhas values ('re-assinar um prontuário assinado foi aceito');
  exception when check_violation then null;
  end;
  begin
    perform sign_medical_record(v_t.rec_a, 'review');
    insert into t_falhas values ('prontuário assinado voltou para revisado');
  exception when check_violation then null;
  end;

  -- 6. Prontuário de OUTRO médico é inalcançável — nem ler, nem assinar.
  if exists (select 1 from myia_medical_records where id = v_t.rec_outro) then
    insert into t_falhas values ('médico enxergou prontuário de outro profissional');
  end if;
  begin
    perform sign_medical_record(v_t.rec_outro, 'sign');
    insert into t_falhas values ('médico assinou prontuário de outro profissional');
  exception when no_data_found then null;
  end;

  -- 7. Ação inventada não passa.
  begin
    perform sign_medical_record(v_t.rec_a, 'apagar');
    insert into t_falhas values ('ação inválida foi aceita');
  exception when invalid_parameter_value then null;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claims', null, true);
end
$bateria$;

-- 8. O TEXTO CLÍNICO NÃO MUDOU em nada disso. É a asserção que fecha a suíte:
--    tudo acima podia passar e a assinatura ainda assim não valer nada, se
--    revisar/assinar tivesse mexido no conteúdo.
insert into t_falhas
select 'o texto clínico foi alterado durante revisão/assinatura'
  from myia_medical_records r
  join t_antes a on a.id = r.id
 where r.anamnesis  is distinct from a.anamnesis
    or r.assessment is distinct from a.assessment
    or r.plan       is distinct from a.plan;

select msg from t_falhas;
