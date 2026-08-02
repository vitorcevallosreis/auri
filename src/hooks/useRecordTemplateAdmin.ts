import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/config';
import { describeSupabaseError } from './useAppointmentMetrics';
import type { RecordTemplate, TemplateField } from './useMedicalRecords';

export interface TemplateInput {
  name: string;
  specialty: string | null;
  description: string | null;
  fields: TemplateField[];
}

export interface SaveResult {
  ok: boolean;
  id?: string;
  message?: string;
}

/**
 * Traduz os erros que 0023 levanta de propósito.
 *
 * O `23514` é o único que o usuário consegue causar sozinho e o único que ele
 * consegue corrigir: é o CHECK de forma dos campos. Os outros dois só aparecem
 * se a tela deixar passar algo que ela deveria ter barrado antes — aparecem
 * aqui para não virarem "erro desconhecido" numa tela de produção.
 */
function describeTemplateError(err: any): string {
  const code = err?.code;
  if (code === '23514') {
    return 'Algum campo está incompleto: verifique se todos têm nome e se as listas de opções não estão vazias.';
  }
  if (code === '23505') return 'Já existe um modelo com esse nome nesta clínica.';
  if (code === '42501') return 'Você não tem permissão para alterar este modelo.';
  return describeSupabaseError(err);
}

const SELECT = 'id, name, specialty, description, fields, is_system, company_id';

function toTemplate(row: any): RecordTemplate {
  return {
    id: row.id,
    name: row.name,
    specialty: row.specialty ?? null,
    description: row.description ?? null,
    fields: Array.isArray(row.fields) ? row.fields : [],
    isSystem: row.is_system ?? row.company_id == null,
  };
}

/**
 * Catálogo com as ações de escrita, para o painel do dono.
 *
 * Separado de `useRecordTemplates` (leitura, área do médico) porque as duas
 * telas têm necessidades diferentes: lá basta a lista; aqui é preciso recarregar
 * depois de gravar, distinguir modelo do sistema do próprio, e devolver erro
 * legível. Fundir as duas faria a tela do médico carregar código que o RLS não
 * deixa ele executar.
 */
export function useRecordTemplateAdmin(companyId?: string) {
  const [templates, setTemplates] = useState<RecordTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from('myia_record_templates')
        .select(SELECT)
        .is('archived_at', null)
        .order('is_system', { ascending: false })
        .order('specialty', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true });

      if (qErr) throw qErr;
      setTemplates((data ?? []).map(toTemplate));
    } catch (err: any) {
      const message = describeSupabaseError(err);
      console.error('[useRecordTemplateAdmin] Erro ao listar modelos:', message, err);
      setError(message);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const criar = useCallback(
    async (input: TemplateInput): Promise<SaveResult> => {
      if (!companyId) return { ok: false, message: 'Empresa não identificada.' };
      setSaving(true);
      try {
        const { data, error: qErr } = await supabase
          .from('myia_record_templates')
          // `company_id` é escrito explicitamente, e não deixado para um default:
          // é ele que separa "modelo desta clínica" de "modelo do sistema", e o
          // `with check` de 0023 recusa nulo vindo daqui.
          .insert({ company_id: companyId, ...input })
          .select('id')
          .single();

        if (qErr) throw qErr;
        await carregar();
        return { ok: true, id: data.id };
      } catch (err: any) {
        const message = describeTemplateError(err);
        console.error('[useRecordTemplateAdmin] Erro ao criar modelo:', message, err);
        return { ok: false, message };
      } finally {
        setSaving(false);
      }
    },
    [companyId, carregar]
  );

  const atualizar = useCallback(
    async (id: string, input: TemplateInput): Promise<SaveResult> => {
      setSaving(true);
      try {
        const { data, error: qErr } = await supabase
          .from('myia_record_templates')
          .update({ ...input, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select('id');

        if (qErr) throw qErr;
        // Zero linhas = o RLS não achou o modelo. Acontece ao tentar salvar um
        // do catálogo do sistema, e o PostgREST não chama isso de erro — sem
        // esta checagem a tela diria "salvo" sem ter salvado nada.
        if (!data || data.length === 0) {
          return {
            ok: false,
            message: 'Este modelo não pode ser alterado. Modelos do sistema são somente leitura — duplique-o para criar uma versão sua.',
          };
        }
        await carregar();
        return { ok: true, id };
      } catch (err: any) {
        const message = describeTemplateError(err);
        console.error('[useRecordTemplateAdmin] Erro ao salvar modelo:', message, err);
        return { ok: false, message };
      } finally {
        setSaving(false);
      }
    },
    [carregar]
  );

  /**
   * Arquiva em vez de apagar.
   *
   * `myia_medical_records.template_id` tem `on delete set null`: apagar de
   * verdade deixaria prontuários antigos sem modelo, e a tela do médico cairia
   * no SOAP de emergência para registros que não são SOAP — os rótulos
   * mudariam debaixo de um documento assinado. Arquivar tira do catálogo e
   * preserva o que já foi escrito.
   */
  const arquivar = useCallback(
    async (id: string): Promise<SaveResult> => {
      setSaving(true);
      try {
        const { data, error: qErr } = await supabase
          .from('myia_record_templates')
          .update({ archived_at: new Date().toISOString() })
          .eq('id', id)
          .select('id');

        if (qErr) throw qErr;
        if (!data || data.length === 0) {
          return { ok: false, message: 'Este modelo não pode ser arquivado.' };
        }
        await carregar();
        return { ok: true, id };
      } catch (err: any) {
        const message = describeTemplateError(err);
        console.error('[useRecordTemplateAdmin] Erro ao arquivar modelo:', message, err);
        return { ok: false, message };
      } finally {
        setSaving(false);
      }
    },
    [carregar]
  );

  return { templates, loading, error, saving, criar, atualizar, arquivar, recarregar: carregar };
}

/** Um modelo para edição. `null` em `id` significa criação. */
export function useRecordTemplate(id: string | null) {
  const [template, setTemplate] = useState<RecordTemplate | null>(null);
  const [loading, setLoading] = useState(id !== null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setTemplate(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: qErr } = await supabase
          .from('myia_record_templates')
          .select(SELECT)
          .eq('id', id)
          .maybeSingle();

        if (qErr) throw qErr;
        if (cancelled) return;
        setTemplate(data ? toTemplate(data) : null);
      } catch (err: any) {
        if (cancelled) return;
        const message = describeSupabaseError(err);
        console.error('[useRecordTemplate] Erro ao carregar modelo:', message, err);
        setError(message);
        setTemplate(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return { template, loading, error };
}
