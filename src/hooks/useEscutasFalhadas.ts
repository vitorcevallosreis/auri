import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/config';
import { describeSupabaseError } from './useAppointmentMetrics';

/**
 * Escutas que falharam e ainda podem ser recuperadas.
 *
 * POR QUE ESTE HOOK EXISTE. O worker grava a transcrição no banco ANTES de o
 * modelo redigir, justamente para que uma falha de redação não leve embora o
 * texto da consulta (ver 0027). Só que até 0028 nada devolvia esse texto ao
 * médico: a sessão terminava em `failed`, o texto ficava na linha e a única
 * coisa irrepetível do sistema — a consulta — ficava inalcançável.
 *
 * A transcrição vem por RLS de leitura (0025). Ela NÃO é editável aqui, nem em
 * lugar nenhum: é a fonte contra a qual o rascunho clínico se audita, e uma
 * fonte que o autor do rascunho pode reescrever não audita nada.
 */
export interface EscutaFalhada {
  id: string;
  paciente: string;
  servico: string | null;
  /** Data do atendimento, não a da falha: é por ela que o médico reconhece a consulta. */
  data: string | null;
  motivo: string | null;
  transcricao: string | null;
  quando: string;
  /**
   * Sem transcrição não há recuperação possível: o áudio foi apagado logo após
   * a tentativa e não existe caminho de volta. A tela precisa dizer isso, e não
   * oferecer um botão que sempre falharia.
   */
  recuperavel: boolean;
  /** O atendimento ganhou prontuário por outro caminho enquanto isso. */
  jaTemProntuario: boolean;
}

export function useEscutasFalhadas() {
  const [escutas, setEscutas] = useState<EscutaFalhada[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('myia_listening_sessions')
        .select(
          'id, transcript, failure_reason, updated_at, appointment_id, ' +
            'myia_appointments(cliente_nome, appointment_date, myia_services(name))'
        )
        .eq('status', 'failed')
        .order('updated_at', { ascending: false })
        .limit(20);

      if (err) throw err;

      const linhas = data ?? [];
      const apptIds = linhas.map((s: any) => s.appointment_id).filter(Boolean);

      // Uma consulta só para todos: saber quais já ganharam prontuário por
      // outro caminho evita oferecer um botão que a RPC recusaria (23505).
      let comProntuario = new Set<string>();
      if (apptIds.length) {
        const { data: recs, error: recErr } = await supabase
          .from('myia_medical_records')
          .select('appointment_id')
          .in('appointment_id', apptIds);
        if (recErr) throw recErr;
        comProntuario = new Set((recs ?? []).map((r: any) => r.appointment_id));
      }

      setEscutas(
        linhas.map((s: any) => {
          const appt = Array.isArray(s.myia_appointments)
            ? s.myia_appointments[0]
            : s.myia_appointments;
          const svc = appt && (Array.isArray(appt.myia_services) ? appt.myia_services[0] : appt.myia_services);
          const texto = (s.transcript ?? '').trim();
          return {
            id: s.id,
            paciente: appt?.cliente_nome ?? 'Paciente sem nome',
            servico: svc?.name ?? null,
            data: appt?.appointment_date ?? null,
            motivo: s.failure_reason ?? null,
            transcricao: texto || null,
            quando: s.updated_at,
            recuperavel: texto.length > 0,
            jaTemProntuario: comProntuario.has(s.appointment_id),
          };
        })
      );
    } catch (err: any) {
      const message = describeSupabaseError(err);
      console.error('[useEscutasFalhadas] Erro:', message, err);
      setError(message);
      setEscutas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /**
   * Devolve a sessão à fila para o modelo redigir de novo, partindo da
   * transcrição salva. Quem valida tudo é a RPC (0028) — repetir as regras
   * aqui só criaria uma segunda versão delas para discordar da primeira.
   */
  const redigirDeNovo = useCallback(
    async (id: string): Promise<{ ok: boolean; message?: string }> => {
      const { error: err } = await supabase.rpc('requeue_listening_draft', {
        p_session_id: id,
      });
      if (err) {
        const message =
          (err as any).code === '23505'
            ? 'Este atendimento já tem prontuário.'
            : (err as any).code === 'P0002'
              ? 'Esta escuta não chegou a produzir transcrição.'
              : describeSupabaseError(err);
        console.error('[useEscutasFalhadas] redigirDeNovo:', message, err);
        return { ok: false, message };
      }
      await carregar();
      return { ok: true };
    },
    [carregar]
  );

  return { escutas, loading, error, recarregar: carregar, redigirDeNovo };
}
