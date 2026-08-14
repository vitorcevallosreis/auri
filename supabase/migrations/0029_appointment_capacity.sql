-- ===========================================================================
-- 0029 — Capacidade do horário: dois pacientes nunca na mesma cadeira
--
-- POR QUE AGORA.
--
-- Até aqui só uma tela escrevia em `myia_appointments`, operada por uma pessoa
-- que enxerga a agenda antes de clicar. O agente do WhatsApp (P3.4) passa a ser
-- um segundo escritor, concorrente, que decide sozinho e rápido — e o modelo
-- pode alucinar horário. Disponibilidade conferida numa consulta e gravada em
-- outra deixa uma janela entre as duas; com dois pacientes conversando ao mesmo
-- tempo, essa janela é alcançável de verdade.
--
-- A garantia tem de estar NO BANCO. Se estivesse na ferramenta do agente, o
-- painel continuaria podendo gravar por cima — e é justamente o cruzamento
-- entre a recepcionista e o agente que produz o duplo agendamento embaraçoso.
--
--
-- POR QUE GATILHO, E NÃO `EXCLUDE USING gist` (que era o desenho inicial).
--
-- A constraint de exclusão é a ferramenta canônica para isto e foi descartada
-- por dois motivos concretos, os dois medidos neste banco:
--
--   1. ELA NÃO SERIA SEQUER CRIADA. `alter table ... add constraint exclude`
--      valida as linhas existentes, e há **324 pares de agendamentos que já se
--      sobrepõem** (dado de demonstração, todos passados e `completed`). A
--      migration falharia, e "limpar 324 linhas históricas" não é preço que se
--      pague para ganhar uma garantia sobre linhas futuras.
--
--   2. ELA DIRIA A COISA ERRADA. `myia_professional_availability` tem
--      `max_simultaneous_clients`, e `consultar_disponibilidade` já o respeita
--      (`rule.max_simultaneous_clients ?? 1`). Sessão em grupo é um conceito
--      que o schema suporta desde 0006. Uma constraint de exclusão só sabe
--      dizer "nenhuma sobreposição" — proibiria o que a clínica configurou.
--
-- O gatilho não tem nenhum dos dois problemas: só olha a linha que está sendo
-- escrita (história suja não o incomoda) e consulta a capacidade configurada.
--
--
-- POR QUE O LOCK CONSULTIVO É A PARTE QUE IMPORTA.
--
-- Contar ocupação e depois inserir são duas operações. Sem serializar, duas
-- transações simultâneas contam "0 ocupados" e ambas inserem — o gatilho teria
-- passado nas duas, e o duplo agendamento aconteceria com a checagem ligada.
--
-- `pg_advisory_xact_lock` sobre (profissional, data) faz a contagem e a escrita
-- virarem uma coisa só. O lock é por profissional-dia, não por tabela: duas
-- marcações em agendas diferentes não esperam uma pela outra. É liberado no
-- commit, sem linha de lock, sem limpeza.
--
--
-- O QUE ESTE GATILHO **NÃO** FAZ.
--
-- Ele não exige que o horário caia dentro da janela de atendimento. É
-- deliberado: encaixe fora do expediente é decisão legítima da recepcionista, e
-- um banco que a proíbe vira um banco que se contorna. Quem não pode oferecer
-- horário fora da agenda é o AGENTE, e isso é regra da ferramenta dele
-- (`consultar_disponibilidade` só enumera o que a agenda permite).
--
-- Divisão: o banco garante "duas pessoas não ocupam a mesma cadeira"; a
-- ferramenta garante "o agente só oferece o que a clínica publicou".
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. A checagem
-- ---------------------------------------------------------------------------

create or replace function myia_appointments_check_capacity()
returns trigger
language plpgsql
security definer          -- um invariante não pode depender do que o chamador
set search_path = public  -- enxerga: com RLS o count veria só parte das linhas
as $$
declare
  v_capacidade int;
  v_ocupados   int;
begin
  -- Cancelado não ocupa. Mesma regra de `consultar_disponibilidade`, que faz
  -- `.neq("status","cancelled")` — se as duas divergirem, o agente oferece um
  -- horário que a escrita recusa, e o paciente leva um erro sem entender.
  if new.status = 'cancelled' then
    return new;
  end if;

  -- Num UPDATE que não mexe em ocupação (mudou `notes`, `valor_cobrado`,
  -- marcou `completed`), não há nada a reconferir. Sem esta saída, editar uma
  -- das 324 linhas históricas sobrepostas passaria a falhar.
  if tg_op = 'UPDATE'
     and old.status <> 'cancelled'
     and old.professional_id  = new.professional_id
     and old.appointment_date = new.appointment_date
     and old.start_time       = new.start_time
     and old.end_time         = new.end_time then
    return new;
  end if;

  if new.end_time <= new.start_time then
    raise exception 'O horário de término tem de ser depois do início'
      using errcode = '22023';
  end if;

  -- Serializa esta agenda-dia. Tudo abaixo vê um estado estável.
  perform pg_advisory_xact_lock(
    hashtext(new.professional_id::text || '|' || new.appointment_date::text)
  );

  -- Capacidade configurada para (profissional, serviço, dia da semana).
  -- `isodow` é 1=Segunda … 7=Domingo, a mesma convenção de `weekday` na tabela
  -- e de `isoWeekday()` em worker/tools.mts. Um mapa deslocado aqui liberaria
  -- capacidade no dia errado sem erro nenhum.
  select max(av.max_simultaneous_clients)
    into v_capacidade
    from myia_professional_availability av
   where av.professional_id = new.professional_id
     and av.service_id      = new.service_id
     and av.weekday         = extract(isodow from new.appointment_date)::int;

  -- Sem regra de agenda, um paciente por vez. É o mesmo default do
  -- `?? 1` em consultar_disponibilidade, e é o lado seguro do erro.
  v_capacidade := coalesce(v_capacidade, 1);

  select count(*)
    into v_ocupados
    from myia_appointments a
   where a.professional_id  = new.professional_id
     and a.appointment_date = new.appointment_date
     and a.status <> 'cancelled'
     and a.id is distinct from new.id          -- não conta a si mesmo no UPDATE
     and a.start_time < new.end_time
     and new.start_time < a.end_time;

  if v_ocupados >= v_capacidade then
    -- Mensagem que pode ser lida em voz alta ao paciente: o agente devolve o
    -- texto do erro, e "duplicate key value violates unique constraint" não é
    -- coisa que se diga a alguém que só queria marcar uma consulta.
    raise exception
      'Este horário já está ocupado para % em % às %.',
      new.professional_id, new.appointment_date, to_char(new.start_time, 'HH24:MI')
      using errcode = '23P01';  -- exclusion_violation: o chamador distingue
  end if;

  return new;
end;
$$;

comment on function myia_appointments_check_capacity() is
  'Impede que a ocupação de um profissional num horário passe da capacidade '
  'configurada em myia_professional_availability (default 1). Serializa por '
  '(profissional, data) com lock consultivo — ver cabeçalho de 0029.';

drop trigger if exists myia_appointments_capacity on myia_appointments;
create trigger myia_appointments_capacity
  before insert or update on myia_appointments
  for each row execute function myia_appointments_check_capacity();

-- ---------------------------------------------------------------------------
-- 2. Índice que sustenta a contagem
-- ---------------------------------------------------------------------------
-- O gatilho roda em TODA escrita de agendamento. Sem índice a contagem varre a
-- tabela inteira (3.740 linhas hoje, e ela só cresce), segurando o lock por
-- mais tempo e estreitando a agenda-dia sob concorrência.

create index if not exists myia_appointments_prof_data_idx
  on myia_appointments (professional_id, appointment_date)
  where status <> 'cancelled';
