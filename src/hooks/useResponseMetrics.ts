import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/config';
import { describeSupabaseError } from './useAppointmentMetrics';

export interface ResponseMetrics {
  /** quantas mensagens de paciente entraram na conta da média */
  samples: number;
  /** minutos entre a mensagem do paciente e a resposta da assistente */
  avgWaitMinutes: number;
  /** assistentes de IA no ar (não pausadas) */
  activeAssistants: number;
}

const EMPTY: ResponseMetrics = { samples: 0, avgWaitMinutes: 0, activeAssistants: 0 };

/**
 * Tempo de espera no WhatsApp e quantas assistentes estão ativas.
 * Agregado por `dashboard_response_metrics` (migration 0017): a latência sai do
 * intervalo entre cada mensagem recebida e a primeira resposta seguinte na mesma
 * conversa — cálculo com janela, que não daria para fazer no cliente sem baixar
 * a caixa de mensagens inteira.
 */
export function useResponseMetrics(company_id?: string) {
  const [metrics, setMetrics] = useState<ResponseMetrics>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchMetrics() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: rpcError } = await supabase.rpc('dashboard_response_metrics');
        if (rpcError) throw rpcError;
        if (cancelled) return;

        setMetrics({
          samples: Number(data?.samples ?? 0),
          avgWaitMinutes: Number(data?.avg_wait_minutes ?? 0),
          activeAssistants: Number(data?.active_assistants ?? 0),
        });
      } catch (err: any) {
        if (cancelled) return;
        const message = describeSupabaseError(err);
        console.error('[useResponseMetrics] Erro ao buscar tempo de resposta:', message, err);
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
