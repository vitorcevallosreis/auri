import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/config';
import { describeSupabaseError } from './useAppointmentMetrics';

export type ReviewStatus = 'pending' | 'reviewed' | 'signed';
export type RecordSource = 'ai' | 'manual';

export interface MedicalRecordSummary {
  id: string;
  recordDate: string;
  patient: string;
  service: string | null;
  source: RecordSource;
  reviewStatus: ReviewStatus;
}

export interface MedicalRecordDetail extends MedicalRecordSummary {
  chiefComplaint: string | null;
  anamnesis: string | null;
  physicalExam: string | null;
  assessment: string | null;
  plan: string | null;
  aiModel: string | null;
  aiGeneratedAt: string | null;
  reviewedAt: string | null;
  signedAt: string | null;
  startTime: string | null;
  endTime: string | null;
}

export const PAGE_SIZE = 25;

/**
 * Nome do vínculo entre prontuário e agendamento, citado explicitamente.
 *
 * `myia_appointments` sozinho seria ambíguo enquanto existirem duas chaves
 * estrangeiras entre as tabelas. A migration 0020 remove a duplicata, mas o
 * PostgREST guarda o schema em cache e a resposta de erro chega a ser servida
 * pela borda — na prática a lista continuava quebrada por vários minutos depois
 * do banco já estar certo.
 *
 * Citar o constraint resolve nos dois mundos: funciona com o schema antigo em
 * cache e com o novo. O acoplamento ao nome é o preço, e ele é nosso — está
 * definido em supabase/migrations/0020_medical_records.sql.
 */
const FK_APPOINTMENT = 'myia_appointments!myia_medical_records_appointment_professional_fk';

/** Normaliza a linha crua do PostgREST, incluindo o embed que pode vir como
 *  objeto ou array conforme a cardinalidade inferida. */
function toSummary(r: any): MedicalRecordSummary {
  const appt = Array.isArray(r.myia_appointments) ? r.myia_appointments[0] : r.myia_appointments;
  const svc = appt && (Array.isArray(appt.myia_services) ? appt.myia_services[0] : appt.myia_services);
  return {
    id: r.id,
    recordDate: r.record_date,
    patient: appt?.cliente_nome ?? 'Paciente sem nome',
    service: svc?.name ?? null,
    source: r.source,
    reviewStatus: r.review_status,
  };
}

/**
 * Lista paginada dos prontuários do próprio médico.
 *
 * Ordena por `record_date`, a coluna denormalizada de 0020 — o PostgREST não
 * ordena por coluna de tabela embedada sem recorrer a `!inner`, e era isso ou
 * trazer tudo para ordenar no cliente.
 */
export function useMedicalRecords(
  status: ReviewStatus | 'all',
  page: number,
  search: string
) {
  const [records, setRecords] = useState<MedicalRecordSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchRecords() {
      setLoading(true);
      setError(null);
      try {
        let query = supabase
          .from('myia_medical_records')
          .select(
            `id, record_date, source, review_status, ${FK_APPOINTMENT}!inner(cliente_nome, myia_services(name))`,
            { count: 'exact' }
          )
          .order('record_date', { ascending: false })
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

        if (status !== 'all') query = query.eq('review_status', status);
        // `!inner` acima é o que permite filtrar por coluna do agendamento.
        if (search.trim()) {
          query = query.ilike(`${FK_APPOINTMENT}.cliente_nome`, `%${search.trim()}%`);
        }

        const { data, error: qErr, count } = await query;
        if (qErr) throw qErr;
        if (cancelled) return;

        setRecords((data ?? []).map(toSummary));
        setTotal(count ?? 0);
      } catch (err: any) {
        if (cancelled) return;
        const message = describeSupabaseError(err);
        console.error('[useMedicalRecords] Erro ao listar prontuários:', message, err);
        setError(message);
        setRecords([]);
        setTotal(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchRecords();
    return () => {
      cancelled = true;
    };
  }, [status, page, search]);

  return { records, total, loading, error };
}

/** Um prontuário. Sem filtro por profissional: o RLS já garante que só os dele
 *  são alcançáveis, então um id de outro médico devolve simplesmente nada. */
export function useMedicalRecord(id: string) {
  const [record, setRecord] = useState<MedicalRecordDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchRecord() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: qErr } = await supabase
          .from('myia_medical_records')
          .select(
            `id, record_date, source, review_status, chief_complaint, anamnesis, physical_exam, assessment, plan, ai_model, ai_generated_at, reviewed_at, signed_at, ${FK_APPOINTMENT}(cliente_nome, start_time, end_time, myia_services(name))`
          )
          .eq('id', id)
          .maybeSingle();

        if (qErr) throw qErr;
        if (cancelled) return;

        if (!data) {
          setRecord(null);
          return;
        }

        const appt: any = Array.isArray(data.myia_appointments)
          ? data.myia_appointments[0]
          : data.myia_appointments;

        setRecord({
          ...toSummary(data),
          chiefComplaint: data.chief_complaint,
          anamnesis: data.anamnesis,
          physicalExam: data.physical_exam,
          assessment: data.assessment,
          plan: data.plan,
          aiModel: data.ai_model,
          aiGeneratedAt: data.ai_generated_at,
          reviewedAt: data.reviewed_at,
          signedAt: data.signed_at,
          startTime: appt?.start_time ?? null,
          endTime: appt?.end_time ?? null,
        });
      } catch (err: any) {
        if (cancelled) return;
        const message = describeSupabaseError(err);
        console.error('[useMedicalRecord] Erro ao carregar o prontuário:', message, err);
        setError(message);
        setRecord(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (id) fetchRecord();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { record, loading, error };
}
