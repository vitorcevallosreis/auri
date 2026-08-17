import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/config';
import { describeSupabaseError } from './useAppointmentMetrics';

export interface SatisfactionMetrics {
  /** quantas pesquisas foram respondidas */
  responses: number;
  /** média de estrelas, 1 a 5 */
  avgRating: number;
  /** NPS na escala -100..100 */
  nps: number;
  promoters: number;
  passives: number;
  detractors: number;
}

const EMPTY: SatisfactionMetrics = {
  responses: 0,
  avgRating: 0,
  nps: 0,
  promoters: 0,
  passives: 0,
  detractors: 0,
};

/**
 * Satisfação e NPS, a partir de myia_appointment_feedback (migration 0016).
 * Agregado no banco por `dashboard_satisfaction_metrics`, que roda sob o RLS
 * do usuário — cada empresa só soma as próprias respostas.
 */
export function useSatisfactionMetrics(company_id?: string) {
  const [metrics, setMetrics] = useState<SatisfactionMetrics>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchMetrics() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: rpcError } = await supabase.rpc('dashboard_satisfaction_metrics');
        if (rpcError) throw rpcError;
        if (cancelled) return;

        setMetrics({
          responses: Number(data?.responses ?? 0),
          avgRating: Number(data?.avg_rating ?? 0),
          nps: Number(data?.nps ?? 0),
          promoters: Number(data?.promoters ?? 0),
          passives: Number(data?.passives ?? 0),
          detractors: Number(data?.detractors ?? 0),
        });
      } catch (err: any) {
        if (cancelled) return;
        const message = describeSupabaseError(err);
        console.error('[useSatisfactionMetrics] Erro ao buscar satisfação:', message, err);
        setError(message);
        setMetrics(EMPTY);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchMetrics();
    return () => {
      cancelled = true;
    };
  }, [company_id]);

  return { metrics, loading, error };
}
