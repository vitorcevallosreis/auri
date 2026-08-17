import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/config';
import { describeSupabaseError } from './useAppointmentMetrics';
import { clientTz, todayInTz } from '@/lib/utils/DateTime';

export interface DayMetrics {
  /** "YYYY-MM-DD" no fuso do médico */
  today: string;
  todayTotal: number;
  weekTotal: number;
  weekCompleted: number;
  attendanceRate: number;
  avgRating: number;
  ratingResponses: number;
}

export interface TodayAppointment {
  id: string;
  startTime: string;   // "HH:MM:SS"
  endTime: string;
  status: string;
  patient: string;
  service: string | null;
}

const EMPTY: DayMetrics = {
  today: '',
  todayTotal: 0,
  weekTotal: 0,
  weekCompleted: 0,
  attendanceRate: 0,
  avgRating: 0,
  ratingResponses: 0,
};

/**
 * Os números e a agenda de hoje do próprio médico.
 *
 * Duas fontes de propósito: os agregados vêm da RPC `professional_day_metrics`
 * (semana, comparecimento em 90 dias, satisfação — contas sobre muitas linhas,
 * que o PostgREST cortaria em 1000), e a lista de hoje vem de um `select` comum,
 * porque são poucas linhas e o componente quer colunas tipadas.
 *
 * As duas usam a MESMA origem de data (`clientTz`/`todayInTz`), senão a lista e
 * o contador poderiam discordar sobre que dia é hoje na virada da noite.
 */
export function useProfessionalDay() {
  const [metrics, setMetrics] = useState<DayMetrics>(EMPTY);
  const [appointments, setAppointments] = useState<TodayAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchDay() {
      setLoading(true);
      setError(null);
      try {
        const tz = clientTz();
        const hoje = todayInTz(tz);

        const [rpc, lista] = await Promise.all([
          supabase.rpc('professional_day_metrics', { p_tz: tz }),
          supabase
            .from('myia_appointments')
            .select('id, start_time, end_time, status, cliente_nome, myia_services(name)')
            .eq('appointment_date', hoje)
            .order('start_time', { ascending: true }),
        ]);

        if (rpc.error) throw rpc.error;
        if (lista.error) throw lista.error;
        if (cancelled) return;

        const d = rpc.data ?? {};
        setMetrics({
          today: String(d.today ?? hoje),
          todayTotal: Number(d.today_total ?? 0),
          weekTotal: Number(d.week_total ?? 0),
          weekCompleted: Number(d.week_completed ?? 0),
          attendanceRate: Number(d.attendance_rate ?? 0),
          avgRating: Number(d.avg_rating ?? 0),
          ratingResponses: Number(d.rating_responses ?? 0),
        });

        setAppointments(
          (lista.data ?? []).map((a: any) => ({
            id: a.id,
            startTime: a.start_time,
            endTime: a.end_time,
            status: a.status,
            patient: a.cliente_nome ?? 'Paciente sem nome',
            // O embed vem como objeto ou array dependendo da cardinalidade que o
            // PostgREST infere; normalizamos para não vazar essa diferença.
            service: Array.isArray(a.myia_services)
              ? a.myia_services[0]?.name ?? null
              : a.myia_services?.name ?? null,
          }))
        );
      } catch (err: any) {
        if (cancelled) return;
        const message = describeSupabaseError(err);
        console.error('[useProfessionalDay] Erro ao carregar o dia:', message, err);
        setError(message);
        setMetrics(EMPTY);
        setAppointments([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDay();
    return () => {
      cancelled = true;
    };
  }, []);

  return { metrics, appointments, loading, error };
}
