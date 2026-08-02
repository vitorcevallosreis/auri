-- Agregações da área do profissional.
--
-- Mesmo estilo de 0017: `security invoker`, SEM parâmetro de tenant nem de
-- profissional. O escopo vem inteiramente do RLS — não existe superfície para
-- consultar o dado de outro médico, nem por engano nem de propósito.
--
-- POR QUE `p_tz` (e por que 0017 deveria ter também): `current_date` no Supabase
-- é UTC. Num recorte mensal isso é cosmético; numa tela chamada "Meu Dia" é
-- fatal — às 21h de Brasília o médico veria a agenda de amanhã. O fuso vem do
-- relógio do navegador, resolvido em src/lib/utils/DateTime.ts.

-- ------------------------------------------------------------------- Meu Dia
create or replace function professional_day_metrics(p_tz text default 'America/Sao_Paulo')
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with b as (
    select (now() at time zone p_tz)::date as today
  ),
  wk as (
    select date_trunc('week', b.today)::date                       as week_start,
           (date_trunc('week', b.today) + interval '6 days')::date as week_end
    from b
  ),
  week_appts as (
    select a.* from myia_appointments a, wk
    where a.appointment_date between wk.week_start and wk.week_end
  ),
  last90 as (
    select a.* from myia_appointments a, b
    where a.appointment_date >= b.today - 90
      and a.appointment_date <= b.today
  ),
  sat as (
    select count(*) as responses, avg(f.rating) as avg_rating
    from myia_appointment_feedback f
    join last90 a on a.id = f.appointment_id
  ),
  series as (
    select jsonb_agg(jsonb_build_object('date', d, 'total', t) order by d) as pts
    from (select appointment_date as d, count(*) as t from week_appts group by 1) s
  )
  select jsonb_build_object(
    'today',          (select today from b),
    'today_total',    (select count(*) from myia_appointments a, b
                       where a.appointment_date = b.today and a.status <> 'cancelled'),
    'week_total',     (select count(*) from week_appts where status in ('scheduled','completed')),
    'week_completed', (select count(*) from week_appts where status = 'completed'),
    'week_series',    coalesce((select pts from series), '[]'::jsonb),
    -- Comparecimento: dos ciclos ENCERRADOS, quantos o paciente honrou. Mesma
    -- definição de resolutionRate em src/hooks/useAppointmentMetrics.ts, para os
    -- dois painéis não discordarem sobre o que a palavra significa.
    'attendance_rate', (select case
                          when count(*) filter (where status in ('completed','no_show')) = 0 then 0
                          else round(count(*) filter (where status = 'completed')::numeric * 100
                                     / count(*) filter (where status in ('completed','no_show')))
                        end from last90),
    'avg_rating',       (select round(coalesce(avg_rating, 0)::numeric, 1) from sat),
    'rating_responses', (select responses from sat)
  );
$$;

-- --------------------------------------------------------------- Meu Financeiro
create or replace function professional_revenue_metrics(
  months_back int default 6,
  p_tz text default 'America/Sao_Paulo'
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with b as (
    select date_trunc('month', (now() at time zone p_tz))::date                        as this_month,
           (date_trunc('month', (now() at time zone p_tz)) - interval '1 month')::date as last_month,
           -- MESMO PONTO do mês anterior. Comparar o mês corrente (parcial)
           -- contra o mês anterior INTEIRO compara coisas de tamanhos
           -- diferentes: no dia 2 a tela mostrava "-98% vs. mês anterior",
           -- aritmeticamente correto e completamente enganoso. Com este recorte,
           -- dois dias de agosto são comparados com dois dias de julho.
           ((now() at time zone p_tz)::date - interval '1 month')::date               as last_month_same_day,
           (date_trunc('month', (now() at time zone p_tz))
             - make_interval(months => months_back))::date                             as first_month,
           date_trunc('year', (now() at time zone p_tz))::date                         as this_year
  ),
  -- valor_cobrado só é preenchido em 'completed', e é o que a CLÍNICA cobrou —
  -- não existe coluna de repasse ao médico no schema. Por isso a tela rotula
  -- "valor dos atendimentos que você realizou", nunca "seus ganhos".
  done as (
    select a.appointment_date, coalesce(a.valor_cobrado, 0) as v, a.service_id
    from myia_appointments a, b
    where a.status = 'completed' and a.appointment_date >= b.first_month
  ),
  monthly as (
    select jsonb_agg(jsonb_build_object('month', m, 'total', tot, 'count', c) order by m) as pts
    from (select to_char(date_trunc('month', appointment_date), 'YYYY-MM') as m,
                 sum(v) as tot, count(*) as c
          from done group by 1) s
  ),
  by_service as (
    select jsonb_agg(jsonb_build_object('service', name, 'total', tot, 'count', c)
                     order by tot desc) as rows
    from (select s.name, sum(d.v) as tot, count(*) as c
          from done d join myia_services s on s.id = d.service_id, b
          where d.appointment_date >= b.this_month
          group by 1 order by 2 desc limit 5) x
  )
  select jsonb_build_object(
    'month_total',      (select coalesce(sum(v), 0) from done, b where appointment_date >= b.this_month),
    'month_count',      (select count(*)            from done, b where appointment_date >= b.this_month),
    -- Do início do mês anterior até o MESMO DIA dele, para a variação comparar
    -- períodos de igual tamanho.
    'last_month_total', (select coalesce(sum(v), 0) from done, b
                          where appointment_date >= b.last_month
                            and appointment_date <= b.last_month_same_day),
    'year_total',       (select coalesce(sum(v), 0) from done, b where appointment_date >= b.this_year),
    'avg_ticket',       (select case when count(*) = 0 then 0 else round(sum(v) / count(*), 2) end
                          from done, b where appointment_date >= b.this_month),
    'monthly',          coalesce((select pts  from monthly),    '[]'::jsonb),
    'by_service',       coalesce((select rows from by_service), '[]'::jsonb)
  );
$$;

-- Sem `anon`, ao contrário de 0017: estas funções são inúteis sem sessão e não
-- há razão para expor a assinatura a quem não autenticou.
grant execute on function professional_day_metrics(text)          to authenticated, service_role;
grant execute on function professional_revenue_metrics(int, text) to authenticated, service_role;
