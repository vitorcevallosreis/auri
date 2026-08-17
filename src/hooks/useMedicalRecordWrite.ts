import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/config';
import { describeSupabaseError } from './useAppointmentMetrics';

export interface AtendimentoSemProntuario {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  patient: string;
  service: string | null;
}

export interface WriteResult {
  ok: boolean;
  id?: string;
  message?: string;
  /** Quando o atendimento já tem prontuário, a tela oferece abrir o existente. */
  jaExiste?: boolean;
}

/**
 * Erros que 0024 levanta de propósito.
 *
 * `23505` não é um erro do usuário: é a corrida entre duas abas, ou o médico
 * voltando no histórico. A tela usa `jaExiste` para oferecer o prontuário que
 * já está lá em vez de pedir que ele tente de novo — tentar de novo nunca
 * funcionaria.
 */
function describeWriteError(err: any): { message: string; jaExiste: boolean } {
  const code = err?.code;
  if (code === '23505') {
    return { message: 'Este atendimento já tem prontuário.', jaExiste: true };
  }
  if (code === '42501') {
    return { message: 'Somente o profissional responsável pode escrever este prontuário.', jaExiste: false };
  }
  if (code === 'P0002') {
    return { message: 'Atendimento ou modelo não encontrado.', jaExiste: false };
  }
  if (code === '23514') {
    return { message: 'Este prontuário já foi assinado e não pode mais ser alterado.', jaExiste: false };
  }
  return { message: describeSupabaseError(err), jaExiste: false };
}

/**
 * Atendimentos do médico que ainda não viraram prontuário.
 *
 * O filtro de "ainda não tem prontuário" é feito no cliente, sobre a mesma
 * janela de datas: o PostgREST não expressa "não existe linha relacionada" sem
 * uma view ou RPC própria, e a janela é pequena o bastante para não valer
 * nenhuma das duas.
 */
export function useAtendimentosSemProntuario(dias = 30) {
  const [atendimentos, setAtendimentos] = useState<AtendimentoSemProntuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const desde = new Date();
      desde.setDate(desde.getDate() - dias);
      const desdeISO = desde.toISOString().slice(0, 10);

      const [apts, recs] = await Promise.all([
        supabase
          .from('myia_appointments')
          .select('id, appointment_date, start_time, end_time, cliente_nome, myia_services(name)')
          .gte('appointment_date', desdeISO)
          .neq('status', 'cancelled')
          .order('appointment_date', { ascending: false })
          .order('start_time', { ascending: false }),
        supabase
          .from('myia_medical_records')
          .select('appointment_id')
          .gte('record_date', desdeISO),
      ]);

      if (apts.error) throw apts.error;
      if (recs.error) throw recs.error;

      const comProntuario = new Set((recs.data ?? []).map((r: any) => r.appointment_id));

      setAtendimentos(
        (apts.data ?? [])
          .filter((a: any) => !comProntuario.has(a.id))
          .map((a: any) => {
            const svc = Array.isArray(a.myia_services) ? a.myia_services[0] : a.myia_services;
            return {
              id: a.id,
              date: a.appointment_date,
              startTime: a.start_time,
              endTime: a.end_time,
              patient: a.cliente_nome ?? 'Paciente sem nome',
              service: svc?.name ?? null,
            };
          })
      );
    } catch (err: any) {
      const message = describeSupabaseError(err);
      console.error('[useAtendimentosSemProntuario] Erro:', message, err);
      setError(message);
      setAtendimentos([]);
    } finally {
      setLoading(false);
    }
  }, [dias]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { atendimentos, loading, error, recarregar: carregar };
}

/** Cria o prontuário de um atendimento, com o modelo já escolhido. */
export function useCriarProntuario() {
  const [saving, setSaving] = useState(false);

  const criar = useCallback(
    async (appointmentId: string, templateId: string): Promise<WriteResult> => {
      setSaving(true);
      try {
        const { data, error } = await supabase
          .rpc('create_medical_record', {
            p_appointment_id: appointmentId,
            p_template_id: templateId,
          })
          .single();

        if (error) throw error;
        return { ok: true, id: (data as any).id };
      } catch (err: any) {
        const { message, jaExiste } = describeWriteError(err);
        console.error('[useCriarProntuario] Erro:', message, err);
        return { ok: false, message, jaExiste };
      } finally {
        setSaving(false);
      }
    },
    []
  );

  return { criar, saving };
}

/** Grava o conteúdo de um prontuário não assinado. */
export function useSalvarProntuario() {
  const [saving, setSaving] = useState(false);

  const salvar = useCallback(
    async (
      recordId: string,
      content: Record<string, string>,
      templateId?: string | null
    ): Promise<WriteResult & { row?: any }> => {
      setSaving(true);
      try {
        const { data, error } = await supabase
          .rpc('save_medical_record', {
            p_record_id: recordId,
            p_content: content,
            p_template_id: templateId ?? null,
          })
          .single();

        if (error) throw error;
        return { ok: true, id: recordId, row: data };
      } catch (err: any) {
        const { message, jaExiste } = describeWriteError(err);
        console.error('[useSalvarProntuario] Erro:', message, err);
        return { ok: false, message, jaExiste };
      } finally {
        setSaving(false);
      }
    },
    []
  );

  return { salvar, saving };
}
