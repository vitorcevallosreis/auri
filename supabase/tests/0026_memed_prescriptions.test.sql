-- Prescrição digital via Memed (0026).
--
-- Duas coisas a proteger: o parser que quebrou `registro` em três campos (ele
-- decidiu o cadastro de 12 profissionais sem ninguém revisar linha a linha), e
-- a receita como comprovante — que não pode ser reescrita nem pendurada no
-- prontuário de outro médico.
--
-- Convenção do runner: qualquer linha retornada é uma falha de asserção.

create temporary table t_falhas (msg text) on commit drop;

-- ------------------------------------------------------------------- o parser
insert into t_falhas
select 'parser errou em "CRM-SP 118432": ' || coalesce(sigla,'-') || '/' || coalesce(uf,'-') || '/' || coalesce(numero,'-')
  from parse_registro_conselho('CRM-SP 118432')
 where sigla is distinct from 'CRM' or uf is distinct from 'SP' or numero is distinct from '118432';

insert into t_falhas
select 'parser errou com barra: ' || coalesce(sigla,'-') || '/' || coalesce(uf,'-')
  from parse_registro_conselho('CRO/RJ 4471')
 where sigla is distinct from 'CRO' or uf is distinct from 'RJ' or numero is distinct from '4471';

insert into t_falhas
select 'parser errou com espaço: ' || coalesce(sigla,'-')
  from parse_registro_conselho('COREN MG 55231')
 where sigla is distinct from 'COREN' or uf is distinct from 'MG' or numero is distinct from '55231';

-- Sem UF é caso real ("CREFITO-000" existe no seed). Deve extrair o que dá e
-- deixar a UF nula para preenchimento manual, não inventar.
insert into t_falhas
select 'parser inventou UF onde não havia: ' || uf
  from parse_registro_conselho('CREFITO-000') where uf is not null;

-- Lixo não pode virar conselho válido.
insert into t_falhas
select 'parser aceitou texto sem conselho: ' || coalesce(sigla, '-')
  from parse_registro_conselho('registro pendente') where sigla is not null;

-- O backfill não pode ter deixado nada fora dos valores que a Memed aceita —
-- o CHECK garante, mas uma sigla nula em massa significaria parser quebrado.
insert into t_falhas
select 'profissionais sem conselho após o backfill: ' || count(*)::text
  from myia_professionals_medical where conselho_sigla is null
having count(*) > 0;

-- CPF só de dígitos.
do $cpf$
begin
  begin
    update myia_professionals_medical set cpf = '123.456.789-00'
     where id = (select id from myia_professionals_medical limit 1);
    insert into t_falhas values ('aceitou CPF com pontuação');
  exception when check_violation then null;
  end;
end
$cpf$;

-- ------------------------------------------------------------------ a receita
create temporary table t on commit drop as
select
  u.id              as user_a,
  u.professional_id as prof_a,
  (select id from myia_medical_records m
    where m.professional_id = u.professional_id limit 1) as rec_proprio,
  (select id from myia_medical_records m
    where m.professional_id is distinct from u.professional_id limit 1) as rec_alheio
from myia_users u
where u.role = 'professional' and u.professional_id is not null
order by u.created_at limit 1;

select 'seed insuficiente para exercitar receita'
  where exists (select 1 from t where user_a is null or rec_proprio is null or rec_alheio is null);

grant select on t to authenticated;
grant insert on t_falhas to authenticated;

do $bateria$
declare
  v_t   record;
  v_p   myia_prescriptions;
  v_linhas int;
begin
  select * into v_t from t;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_t.user_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  -- 1. Receita sem identificador da Memed é recusada — sem ele não há como
  --    achar o documento assinado do outro lado, e o registro não vale nada.
  begin
    perform record_prescription('  ', null, v_t.rec_proprio, '[]'::jsonb, '[]'::jsonb);
    insert into t_falhas values ('aceitou receita sem uuid da Memed');
  exception when invalid_parameter_value then null;
  end;

  -- 2. Registrar no próprio prontuário funciona.
  v_p := record_prescription('uuid-teste-1', '9001', v_t.rec_proprio,
           '[{"nome":"Losartana 50mg","posologia":"1x/dia"}]'::jsonb, '[]'::jsonb);
  if v_p.medical_record_id is distinct from v_t.rec_proprio then
    insert into t_falhas values ('a receita não ficou vinculada ao prontuário');
  end if;

  -- 3. IDEMPOTÊNCIA. O evento `prescricaoImpressa` chega duas vezes quando o
  --    médico reimprime — duplicar receita no prontuário seria pior que
  --    ignorar a repetição.
  v_p := record_prescription('uuid-teste-1', '9001', v_t.rec_proprio,
           '[{"nome":"Losartana 50mg","posologia":"1x/dia — corrigido"}]'::jsonb, '[]'::jsonb);
  if (select count(*) from myia_prescriptions where memed_uuid = 'uuid-teste-1') <> 1 then
    insert into t_falhas values ('o mesmo evento gerou duas receitas');
  end if;
  if v_p.medicamentos->0->>'posologia' not like '%corrigido%' then
    insert into t_falhas values ('a repetição não atualizou o resumo');
  end if;

  -- 4. Prontuário de OUTRO médico é inalcançável.
  begin
    perform record_prescription('uuid-teste-2', null, v_t.rec_alheio, '[]'::jsonb, '[]'::jsonb);
    insert into t_falhas values ('pendurou receita no prontuário de outro médico');
  exception when no_data_found then null;
  end;

  -- 5. UPDATE direto é negado — a receita é comprovante de ato clínico e não
  --    pode ser reescrita depois do fato.
  update myia_prescriptions set medicamentos = '[]'::jsonb where memed_uuid = 'uuid-teste-1';
  get diagnostics v_linhas = row_count;
  if v_linhas > 0 then
    insert into t_falhas values ('médico reescreveu a receita por UPDATE direto');
  end if;

  execute 'reset role';
  perform set_config('request.jwt.claims', null, true);
end
$bateria$;

select msg from t_falhas;
