-- Capacidade do horário (0029).
--
-- O que esta suíte protege:
--   · dois pacientes não ocupam a mesma cadeira;
--   · cancelar LIBERA o horário — mesma regra que consultar_disponibilidade
--     usa para oferecê-lo, e se as duas divergirem o agente oferece o que a
--     escrita recusa;
--   · `max_simultaneous_clients` é respeitado: sessão em grupo continua
--     possível, que é o motivo de isto ser gatilho e não constraint de
--     exclusão;
--   · editar um agendamento sem mexer no horário não reabre a checagem — sem
--     isso, as 324 linhas históricas sobrepostas deste banco virariam
--     intocáveis;
--   · encaixe fora da janela de atendimento continua permitido (decisão da
--     recepcionista, não do banco).
--
-- Convenção do runner: qualquer linha retornada é uma falha de asserção.

create temporary table t_falhas (msg text) on commit drop;

create temporary table t on commit drop as
select
  p.id         as prof,
  p.company_id as comp,
  (select s.id from myia_services s
    where s.company_id = p.company_id limit 1) as serv
from myia_professionals_medical p
order by p.created_at
limit 1;

-- Uma data futura e distante, para não cruzar com nenhum dado existente.
alter table t add column dia date;
update t set dia = current_date + 400;

select 'seed insuficiente: falta profissional ou serviço'
  where exists (select 1 from t where prof is null or serv is null or comp is null);

do $bateria$
declare
  v_t      record;
  v_id_1   uuid;
  v_id_2   uuid;
  v_erro   text;
begin
  select * into v_t from t;

  -- -----------------------------------------------------------------------
  -- 1. O primeiro agendamento entra.
  -- -----------------------------------------------------------------------
  insert into myia_appointments
    (company_id, professional_id, service_id, appointment_date,
     start_time, end_time, status, cliente_nome)
  values
    (v_t.comp, v_t.prof, v_t.serv, v_t.dia,
     '09:00', '09:30', 'scheduled', 'Paciente Um')
  returning id into v_id_1;

  -- -----------------------------------------------------------------------
  -- 2. Um segundo que SE SOBREPÕE é recusado.
  -- -----------------------------------------------------------------------
  begin
    insert into myia_appointments
      (company_id, professional_id, service_id, appointment_date,
       start_time, end_time, status, cliente_nome)
    values
      (v_t.comp, v_t.prof, v_t.serv, v_t.dia,
       '09:15', '09:45', 'scheduled', 'Paciente Dois');
    insert into t_falhas values
      ('sobreposição foi aceita — dois pacientes na mesma cadeira');
  exception when exclusion_violation then
    null;  -- esperado
  end;

  -- -----------------------------------------------------------------------
  -- 3. Encostado, sem sobrepor, entra. O fim de um é o começo do outro.
  -- -----------------------------------------------------------------------
  begin
    insert into myia_appointments
      (company_id, professional_id, service_id, appointment_date,
       start_time, end_time, status, cliente_nome)
    values
      (v_t.comp, v_t.prof, v_t.serv, v_t.dia,
       '09:30', '10:00', 'scheduled', 'Paciente Encostado')
    returning id into v_id_2;
  exception when exclusion_violation then
    insert into t_falhas values
      ('09:30-10:00 foi recusado depois de 09:00-09:30 — o intervalo está fechado dos dois lados');
  end;

  -- -----------------------------------------------------------------------
  -- 4. Cancelar libera o horário.
  -- -----------------------------------------------------------------------
  update myia_appointments set status = 'cancelled' where id = v_id_1;

  begin
    insert into myia_appointments
      (company_id, professional_id, service_id, appointment_date,
       start_time, end_time, status, cliente_nome)
    values
      (v_t.comp, v_t.prof, v_t.serv, v_t.dia,
       '09:00', '09:30', 'scheduled', 'Paciente Tres');
  exception when exclusion_violation then
    insert into t_falhas values
      ('horário cancelado não foi liberado — consultar_disponibilidade o ofereceria e a escrita recusaria');
  end;

  -- -----------------------------------------------------------------------
  -- 5. Editar sem mexer em horário não reabre a checagem.
  -- -----------------------------------------------------------------------
  begin
    update myia_appointments
       set notes = 'anotação da recepção', status = 'completed'
     where id = v_id_2;
  exception when exclusion_violation then
    insert into t_falhas values
      ('editar campo que não afeta ocupação foi recusado — histórico sobreposto viraria intocável');
  end;

  -- -----------------------------------------------------------------------
  -- 6. Fim antes do início é recusado.
  -- -----------------------------------------------------------------------
  begin
    insert into myia_appointments
      (company_id, professional_id, service_id, appointment_date,
       start_time, end_time, status, cliente_nome)
    values
      (v_t.comp, v_t.prof, v_t.serv, v_t.dia,
       '14:00', '13:00', 'scheduled', 'Paciente Invertido');
    insert into t_falhas values ('intervalo invertido foi aceito');
  exception when others then
    if sqlstate <> '22023' then
      insert into t_falhas values
        ('intervalo invertido falhou pelo motivo errado: ' || sqlstate);
    end if;
  end;
end;
$bateria$;

-- ---------------------------------------------------------------------------
-- 7. Capacidade > 1: sessão em grupo continua possível.
--
-- É o caso que a constraint de exclusão teria proibido, e o motivo de 0029 ser
-- gatilho. Roda em bloco próprio, num dia próprio, para não disputar horário
-- com a bateria acima.
-- ---------------------------------------------------------------------------
do $grupo$
declare
  v_t    record;
  v_dia  date;
begin
  select * into v_t from t;
  v_dia := v_t.dia + 1;

  -- Agenda que permite 2 pacientes ao mesmo tempo, no dia da semana de v_dia.
  insert into myia_professional_availability
    (professional_id, service_id, weekday, start_time, end_time,
     max_simultaneous_clients)
  values
    (v_t.prof, v_t.serv, extract(isodow from v_dia)::int,
     '08:00', '18:00', 2);

  insert into myia_appointments
    (company_id, professional_id, service_id, appointment_date,
     start_time, end_time, status, cliente_nome)
  values
    (v_t.comp, v_t.prof, v_t.serv, v_dia, '10:00', '10:30', 'scheduled', 'Grupo A');

  begin
    insert into myia_appointments
      (company_id, professional_id, service_id, appointment_date,
       start_time, end_time, status, cliente_nome)
    values
      (v_t.comp, v_t.prof, v_t.serv, v_dia, '10:00', '10:30', 'scheduled', 'Grupo B');
  exception when exclusion_violation then
    insert into t_falhas values
      ('capacidade 2 recusou o 2º paciente — max_simultaneous_clients está sendo ignorado');
  end;

  -- O terceiro estoura a capacidade.
  begin
    insert into myia_appointments
      (company_id, professional_id, service_id, appointment_date,
       start_time, end_time, status, cliente_nome)
    values
      (v_t.comp, v_t.prof, v_t.serv, v_dia, '10:00', '10:30', 'scheduled', 'Grupo C');
    insert into t_falhas values
      ('capacidade 2 aceitou o 3º paciente — o teto não está sendo aplicado');
  exception when exclusion_violation then
    null;  -- esperado
  end;
end;
$grupo$;

-- ---------------------------------------------------------------------------
-- 8. O gatilho existe e está ligado nas duas operações.
-- ---------------------------------------------------------------------------
insert into t_falhas
select 'gatilho de capacidade ausente em myia_appointments'
 where not exists (
   select 1 from pg_trigger
    where tgrelid = 'myia_appointments'::regclass
      and tgname  = 'myia_appointments_capacity'
      and not tgisinternal);

select msg from t_falhas;
