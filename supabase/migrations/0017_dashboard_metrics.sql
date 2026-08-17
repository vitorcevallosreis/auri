-- Agregações do painel.
--
-- Por que no banco e não no cliente: o PostgREST corta a resposta em 1000 linhas
-- por padrão. A conta de demonstração já tem ~1.8k agendamentos, então qualquer
-- soma feita no navegador sairia silenciosamente errada — a série mensal perderia
-- os meses do começo e a média por horário viria enviesada. Agregar aqui também
-- troca 6 requisições por 1.
--
-- Todas são `security invoker`: rodam com as permissões de quem chama, então o
-- RLS de myia_appointments/myia_appointment_feedback/myia_chat continua valendo e
-- cada empresa só enxerga o que é seu. Nenhuma recebe company_id por parâmetro,
-- justamente para não existir superfície de consulta cruzada entre tenants.

-- ---------------------------------------------------------------- agendamentos
-- Devolve, numa só chamada: contagens por status, comparação mês a mês, a série
-- mensal do gráfico de volume e a média de duração por horário.
create or replace function dashboard_appointment_metrics(months_back int default 6)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with bounds as (
    select
      date_trunc('month', current_date)::date                                as this_month,
      (date_trunc('month', current_date) - make_interval(months => months_back))::date as first_month,
      (date_trunc('month', current_date) - interval '1 month')::date         as last_month
  ),
  scoped as (
    select a.*, bounds.*
    from myia_appointments a cross join bounds
    where a.appointment_date >= bounds.first_month
  ),
  totals as (
    select
      count(*)                                                          as total,
      count(*) filter (where status = 'completed')                      as completed,
      count(*) filter (where status = 'cancelled')                      as cancelled,
      count(*) filter (where status = 'no_show')                        as no_show,
      count(*) filter (where status in ('scheduled', 'completed'))      as confirmed,
      count(*) filter (where appointment_date >= this_month)            as this_month_total,
      count(*) filter (where appointment_date >= last_month
                         and appointment_date < this_month)             as last_month_total,
      -- Duração real da consulta. `time - time` já devolve interval.
      avg(extract(epoch from (end_time - start_time)) / 60.0)
        filter (where status = 'completed')                             as avg_minutes
    from scoped
  ),
  monthly as (
    select jsonb_agg(jsonb_build_object('month', m, 'total', t) order by m) as series
    from (
      select to_char(date_trunc('month', appointment_date), 'YYYY-MM') as m, count(*) as t
      from scoped group by 1
    ) s
  ),
  hourly as (
    select jsonb_agg(jsonb_build_object('hour', h, 'avg_minutes', round(a::numeric, 1), 'total', t) order by h) as series
    from (
      select extract(hour from start_time)::int as h,
             avg(extract(epoch from (end_time - start_time)) / 60.0) as a,
             count(*) as t
      from scoped where status = 'completed' group by 1
    ) s
  )
  select jsonb_build_object(
    'total',            totals.total,
    'completed',        totals.completed,
    'cancelled',        totals.cancelled,
    'no_show',          totals.no_show,
    'confirmed',        totals.confirmed,
    'this_month',       totals.this_month_total,
    'last_month',       totals.last_month_total,
    'avg_minutes',      round(coalesce(totals.avg_minutes, 0)::numeric, 1),
    'monthly',          coalesce(monthly.series, '[]'::jsonb),
    'hourly',           coalesce(hourly.series, '[]'::jsonb)
  )
  from totals, monthly, hourly;
$$;

-- ------------------------------------------------------------------- satisfação
-- Média de estrelas e a decomposição do NPS.
create or replace function dashboard_satisfaction_metrics()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'responses',  count(*),
    'avg_rating', round(coalesce(avg(rating), 0)::numeric, 1),
    'promoters',  count(*) filter (where nps_score >= 9),
    'passives',   count(*) filter (where nps_score between 7 and 8),
    'detractors', count(*) filter (where nps_score <= 6),
    -- NPS = %promotores - %detratores, na escala -100..100.
    'nps', case when count(*) = 0 then 0 else round(
      (count(*) filter (where nps_score >= 9)::numeric * 100 / count(*)) -
      (count(*) filter (where nps_score <= 6)::numeric * 100 / count(*))
    ) end
  )
  from myia_appointment_feedback;
$$;

-- ---------------------------------------------------------------- atendimento
-- Tempo de espera = intervalo entre a mensagem do paciente e a resposta seguinte
-- da assistente, na mesma conversa. Também conta quantas assistentes estão no ar.
create or replace function dashboard_response_metrics()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with paired as (
    select
      m.created_at as inbound_at,
      -- Primeira resposta nossa depois desta mensagem do paciente.
      min(r.created_at) as reply_at
    from myia_messages m
    join myia_chat c on c.id = m.chat_id
    left join myia_messages r
      on r.chat_id = m.chat_id and r.from_me and r.created_at > m.created_at
    where not m.from_me
    group by m.id, m.created_at
  ),
  latency as (
    select extract(epoch from (reply_at - inbound_at)) as seconds
    from paired
    where reply_at is not null
  )
  select jsonb_build_object(
    'samples',          (select count(*) from latency),
    'avg_wait_minutes', (select round(coalesce(avg(seconds), 0)::numeric / 60, 1) from latency),
    'active_assistants',(select count(*) from myia_assistants where not paused)
  );
$$;

grant execute on function dashboard_appointment_metrics(int) to anon, authenticated, service_role;
grant execute on function dashboard_satisfaction_metrics()  to anon, authenticated, service_role;
grant execute on function dashboard_response_metrics()      to anon, authenticated, service_role;
