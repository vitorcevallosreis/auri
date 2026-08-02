import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/config';

export interface AppointmentSeriesPoint {
  /** "YYYY-MM" */
  month: string;
  total: number;
}

export interface AppointmentHourPoint {
  /** hora do dia, 0-23 */
  hour: number;
  avgMinutes: number;
  total: number;
}

export interface AppointmentMetrics {
  total: number;
  finalized: number;
  pending: number;
  percentChange: number;
  averageTime: number;
  resolutionRate: number;
  /** % de agendamentos que não foram cancelados nem viraram falta */
  confirmedRate: number;
  cancellationRate: number;
  monthly: AppointmentSeriesPoint[];
  hourly: AppointmentHourPoint[];
}

const EMPTY: AppointmentMetrics = {
  total: 0,
  finalized: 0,
  pending: 0,
  percentChange: 0,
  averageTime: 0,
  resolutionRate: 0,
  confirmedRate: 0,
  cancellationRate: 0,
  monthly: [],
  hourly: [],
};

/** Postgrest devolve um objeto simples, não um Error — `console.error` nele
 *  imprime `{}` e esconde a causa. Achata para algo legível. */
export function describeSupabaseError(error: any): string {
  if (!error) return 'Erro desconhecido';
  if (typeof error === 'string') return error;
  const parts = [error.message, error.details, error.hint, error.code && `(${error.code})`];
  return parts.filter(Boolean).join(' — ') || JSON.stringify(error);
}

/**
 * Métricas de agendamento do painel.
 *
 * A agregação mora no banco (`dashboard_appointment_metrics`, migration 0017):
 * o PostgREST corta a resposta em 1000 linhas, então somar no navegador daria
 * número errado sem avisar assim que a base passasse desse tamanho. A função é
 * `security invoker` e o RLS já recorta por empresa — o company_id aqui serve
 * só para refazer a busca quando o usuário/tenant muda.
 */
export function useAppointmentMetrics(company_id?: string, monthsBack = 6) {
  const [metrics, setMetrics] = useState<AppointmentMetrics>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchMetrics() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: rpcError } = await supabase.rpc('dashboard_appointment_metrics', {
          months_back: monthsBack,
        });
        if (rpcError) throw rpcError;
        if (cancelled) return;

        const total = Number(data?.total ?? 0);
        const finalized = Number(data?.completed ?? 0);
        const cancelled_ = Number(data?.cancelled ?? 0);
        const noShow = Number(data?.no_show ?? 0);
        const confirmed = Number(data?.confirmed ?? 0);
        const thisMonth = Number(data?.this_month ?? 0);
        const lastMonth = Number(data?.last_month ?? 0);

        const pct = (part: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

        setMetrics({
          total,
          finalized,
          pending: total - finalized,
          percentChange: lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : 0,
          averageTime: Number(data?.avg_minutes ?? 0),
          // "Comparecimento": das consultas que chegaram ao fim do ciclo,
          // quantas o paciente de fato compareceu.
          resolutionRate:
            finalized + noShow > 0 ? Math.round((finalized / (finalized + noShow)) * 100) : 0,
          confirmedRate: pct(confirmed),
          cancellationRate: pct(cancelled_),
          monthly: (data?.monthly ?? []).map((p: any) => ({
            month: String(p.month),
            total: Number(p.total),
          })),
          hourly: (data?.hourly ?? []).map((p: any) => ({
            hour: Number(p.hour),
            avgMinutes: Number(p.avg_minutes),
            total: Number(p.total),
          })),
        });
      } catch (err: any) {
        if (cancelled) return;
        const message = describeSupabaseError(err);
        console.error('[useAppointmentMetrics] Erro ao buscar métricas:', message, err);
        setError(message);
        // Sem fallback mockado: número inventado no painel é pior que zero,
        // porque não dá para distinguir de dado real.
        setMetrics(EMPTY);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchMetrics();
    return () => {
      cancelled = true;
    };
    // company_id chega depois do primeiro render (vem do contexto de auth);
    // sem ele aqui, a métrica ficaria presa na primeira execução.
  }, [company_id, monthsBack]);

  return { metrics, loading, error };
}
