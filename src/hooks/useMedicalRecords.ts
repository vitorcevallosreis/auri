import { useCallback, useEffect, useState } from 'react';
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

export type FieldType = 'text' | 'textarea' | 'select';

/** Um campo do modelo, como 0023 o descreve em `myia_record_templates.fields`. */
export interface TemplateField {
  key: string;
  label: string;
  type: FieldType;
  icon?: string;
  hint?: string;
  placeholder?: string;
  options?: string[];
  /** Renderiza em superfície de marca, acima da grade. Tipicamente a queixa. */
  highlight?: boolean;
}

export interface RecordTemplate {
  id: string;
  name: string;
  specialty: string | null;
  description: string | null;
  fields: TemplateField[];
  isSystem: boolean;
}

export interface MedicalRecordDetail extends MedicalRecordSummary {
  /**
   * Valores do prontuário, na chave que o modelo define.
   *
   * Substitui as cinco colunas fixas na LEITURA. As colunas continuam no banco
   * e continuam sendo escritas por quem escrevia antes — o gatilho de 0023 as
   * copia para cá, então esta é a única fonte que a tela precisa consultar.
   */
  content: Record<string, string | null>;
  template: RecordTemplate | null;
  aiModel: string | null;
  aiGeneratedAt: string | null;
  reviewedAt: string | null;
  signedAt: string | null;
  startTime: string | null;
  endTime: string | null;
  /**
   * O PACIENTE, não o prontuário.
   *
   * Existe para a prescrição: a Memed identifica o paciente por um id externo
   * nosso, e mandar o id do prontuário criaria um paciente novo a cada
   * consulta — o histórico dele lá se fragmentaria e não se recomporia mais.
   *
   * Nulo é possível (`contact_id` é opcional em 0020) e tem que ser tratado
   * como nulo: cair de volta no id do prontuário seria pior que não mandar id.
   */
  contactId: string | null;
  /** Único dado de contato que temos do paciente — `myia_contacts` não guarda
   *  CPF, nascimento nem e-mail. */
  contactPhone: string | null;
}

/** Normaliza a linha crua de myia_record_templates. */
function toTemplate(t: any): RecordTemplate | null {
  if (!t) return null;
  const row = Array.isArray(t) ? t[0] : t;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    specialty: row.specialty ?? null,
    description: row.description ?? null,
    // `fields` tem CHECK de forma no banco (0023), mas nada garante que a linha
    // veio de lá — um cache velho do PostgREST ou um mock devolveriam qualquer
    // coisa. O filtro abaixo é o que impede a tela de quebrar num `.map`.
    fields: Array.isArray(row.fields)
      ? row.fields.filter((f: any) => f && typeof f.key === 'string' && typeof f.label === 'string')
      : [],
    isSystem: row.is_system ?? row.company_id == null,
  };
}

const TEMPLATE_SELECT = 'myia_record_templates(id, name, specialty, description, fields, is_system)';

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

export type ReviewAction = 'review' | 'sign';

/**
 * Mensagens dos erros que a RPC levanta de propósito (0022).
 *
 * O `describeSupabaseError` genérico devolveria o texto cru do Postgres com
 * SQLSTATE colado; aqui os casos previstos têm nome próprio. O importante é o
 * '23514': ele significa que o estado no banco não é o que a tela está
 * mostrando — outra aba assinou primeiro — e a resposta certa é recarregar, não
 * insistir no clique.
 */
function describeReviewError(err: any): string {
  const code = err?.code;
  if (code === '42501') return 'Somente o profissional responsável pode assinar este prontuário.';
  if (code === 'P0002') return 'Prontuário não encontrado.';
  if (code === '23514') return 'O estado deste prontuário mudou. Recarregue a página.';
  return describeSupabaseError(err);
}

/** Um prontuário. Sem filtro por profissional: o RLS já garante que só os dele
 *  são alcançáveis, então um id de outro médico devolve simplesmente nada. */
export function useMedicalRecord(id: string) {
  const [record, setRecord] = useState<MedicalRecordDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<ReviewAction | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchRecord() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: qErr } = await supabase
          .from('myia_medical_records')
          .select(
            `id, record_date, source, review_status, content, ai_model, ai_generated_at, reviewed_at, signed_at, contact_id, myia_contacts(number), ${TEMPLATE_SELECT}, ${FK_APPOINTMENT}(cliente_nome, start_time, end_time, myia_services(name))`
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

        // Mesmo desempacotamento do embed de appointment/template: o PostgREST
        // devolve objeto ou array conforme a cardinalidade que ele infere.
        const contato: any = Array.isArray((data as any).myia_contacts)
          ? (data as any).myia_contacts[0]
          : (data as any).myia_contacts;

        setRecord({
          ...toSummary(data),
          content: (data.content ?? {}) as Record<string, string | null>,
          template: toTemplate((data as any).myia_record_templates),
          aiModel: data.ai_model,
          aiGeneratedAt: data.ai_generated_at,
          reviewedAt: data.reviewed_at,
          signedAt: data.signed_at,
          startTime: appt?.start_time ?? null,
          endTime: appt?.end_time ?? null,
          contactId: (data as any).contact_id ?? null,
          contactPhone: contato?.number ?? null,
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

  /**
   * Marca revisado ou assina, via a RPC de 0022.
   *
   * Não é um UPDATE do PostgREST porque o médico não tem — e não deve ter —
   * permissão de UPDATE nesta tabela: a RPC é a única porta, e ela toca apenas
   * as três colunas de revisão.
   *
   * O estado local é atualizado com a LINHA QUE O BANCO DEVOLVEU, não com um
   * palpite otimista. Os carimbos de horário são gerados pelo `now()` do
   * servidor; escrever `new Date()` aqui mostraria na tela um horário que não é
   * o que ficou gravado.
   */
  const applyReview = useCallback(
    async (action: ReviewAction): Promise<{ ok: boolean; message?: string }> => {
      if (!id) return { ok: false };
      setSaving(action);
      try {
        const { data, error: rpcErr } = await supabase
          .rpc('sign_medical_record', { p_record_id: id, p_action: action })
          .single();

        if (rpcErr) throw rpcErr;

        const row: any = data;
        setRecord((prev) =>
          prev
            ? {
                ...prev,
                reviewStatus: row.review_status,
                reviewedAt: row.reviewed_at,
                signedAt: row.signed_at,
              }
            : prev
        );
        return { ok: true };
      } catch (err: any) {
        const message = describeReviewError(err);
        console.error('[useMedicalRecord] Erro ao %s prontuário:', action, message, err);
        return { ok: false, message };
      } finally {
        setSaving(null);
      }
    },
    [id]
  );

  return { record, loading, error, saving, applyReview };
}

/**
 * Catálogo de modelos disponíveis para a clínica.
 *
 * Traz o do sistema E o da própria empresa numa consulta só — a policy de
 * leitura de 0023 já une os dois, então não há dois caminhos a manter aqui.
 * Arquivados ficam de fora: eles existem para não quebrar prontuários antigos
 * que apontam para eles, não para serem escolhidos de novo.
 */
export function useRecordTemplates() {
  const [templates, setTemplates] = useState<RecordTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchTemplates() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: qErr } = await supabase
          .from('myia_record_templates')
          .select('id, name, specialty, description, fields, is_system')
          .is('archived_at', null)
          .order('specialty', { ascending: true, nullsFirst: false })
          .order('name', { ascending: true });

        if (qErr) throw qErr;
        if (cancelled) return;

        setTemplates((data ?? []).map(toTemplate).filter(Boolean) as RecordTemplate[]);
      } catch (err: any) {
        if (cancelled) return;
        const message = describeSupabaseError(err);
        console.error('[useRecordTemplates] Erro ao listar modelos:', message, err);
        setError(message);
        setTemplates([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTemplates();
    return () => {
      cancelled = true;
    };
  }, []);

  return { templates, loading, error };
}
