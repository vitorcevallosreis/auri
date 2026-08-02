import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/config';
import { describeSupabaseError } from './useAppointmentMetrics';
import { clientTz } from '@/lib/utils/DateTime';

export interface RevenueMonth {
  /** "YYYY-MM" */
  month: string;
  total: number;
  count: number;
}

export interface RevenueByService {
  service: string;
  total: number;
  count: number;
}

export interface RevenueMetrics {
  monthTotal: number;
  monthCount: number;
  lastMonthTotal: number;
  yearTotal: number;
  avgTicket: number;
  monthly: RevenueMonth[];
  byService: RevenueByService[];
}

const EMPTY: RevenueMetrics = {
  monthTotal: 0,
  monthCount: 0,
  lastMonthTotal: 0,
  yearTotal: 0,
  avgTicket: 0,
  monthly: [],
  byService: [],
};

/**
 * Valor dos atendimentos realizados pelo próprio médico.
 *
 * A palavra importa: `valor_cobrado` é o que a CLÍNICA cobrou pela consulta, e
 * não existe coluna de repasse no schema. Chamar isto de "ganhos" daria um
 * número errado por um fator que ninguém sabe — por isso a tela fala em "valor
 * dos atendimentos".
 */
export function useProfessionalRevenue(monthsBack = 6) {
  const [metrics, setMetrics] = useState<RevenueMetrics>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchRevenue() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: rpcError } = await supabase.rpc(
          'professional_revenue_metrics',
          { months_back: monthsBack, p_tz: clientTz() }
        );
        if (rpcError) throw rpcError;
        if (cancelled) return;

        const d = data ?? {};
        setMetrics({
          monthTotal: Number(d.month_total ?? 0),
          monthCount: Number(d.month_count ?? 0),
          lastMonthTotal: Number(d.last_month_total ?? 0),
          yearTotal: Number(d.year_total ?? 0),
          avgTicket: Number(d.avg_ticket ?? 0),
          monthly: (d.monthly ?? []).map((m: any) => ({
            month: String(m.month),
            total: Number(m.total),
            count: Number(m.count),
          })),
          byService: (d.by_service ?? []).map((s: any) => ({
            service: String(s.service),
            total: Number(s.total),
            count: Number(s.count),
          })),
        });
      } catch (err: any) {
        if (cancelled) return;
        const message = describeSupabaseError(err);
        console.error('[useProfessionalRevenue] Erro ao carregar a receita:', message, err);
        setError(message);
        setMetrics(EMPTY);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchRevenue();
    return () => {
      cancelled = true;
    };
  }, [monthsBack]);

  return { metrics, loading, error };
}

/** Lista de atendimentos faturados, paginada. Só `completed`: nos demais status
 *  o `valor_cobrado` é nulo e a linha não representa receita nenhuma. */
export interface RevenueAppointment {
  id: string;
  date: string;
  patient: string;
  service: string | null;
  value: number;
}

export function useRevenueAppointments(from: string, to: string, limit = 50) {
  const [rows, setRows] = useState<RevenueAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchRows() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: qErr } = await supabase
          .from('myia_appointments')
          .select('id, appointment_date, cliente_nome, valor_cobrado, myia_services(name)')
          .eq('status', 'completed')
          .gte('appointment_date', from)
          .lte('appointment_date', to)
          .order('appointment_date', { ascending: false })
          .limit(limit);

        if (qErr) throw qErr;
        if (cancelled) return;

        setRows(
          (data ?? []).map((a: any) => ({
            id: a.id,
            date: a.appointment_date,
            patient: a.cliente_nome ?? 'Paciente sem nome',
            service: Array.isArray(a.myia_services)
              ? a.myia_services[0]?.name ?? null
              : a.myia_services?.name ?? null,
            value: Number(a.valor_cobrado ?? 0),
          }))
        );
      } catch (err: any) {
        if (cancelled) return;
        const message = describeSupabaseError(err);
        console.error('[useRevenueAppointments] Erro ao listar atendimentos:', message, err);
        setError(message);
        setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchRows();
    return () => {
      cancelled = true;
    };
  }, [from, to, limit]);

  return { rows, loading, error };
}
