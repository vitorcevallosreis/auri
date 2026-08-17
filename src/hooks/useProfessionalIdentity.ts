import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/config';
import { describeSupabaseError } from './useAppointmentMetrics';

export interface ProfessionalIdentity {
  id: string;
  nome: string;
  especialidade: string | null;
  registro: string | null;
  clinica: string | null;
}

const EMPTY: ProfessionalIdentity = {
  id: '',
  nome: '',
  especialidade: null,
  registro: null,
  clinica: null,
};

/**
 * Quem é o médico logado.
 *
 * Não guarda `professional_id` em lugar nenhum do cliente: a policy
 * `professionals_self_read` (migration 0019) já restringe
 * myia_professionals_medical à própria linha dele, então uma consulta sem
 * filtro devolve exatamente um registro — o dele. O RLS É o filtro.
 *
 * O `limit(1)` não é o que garante a unicidade; é só um teto. Se algum dia isto
 * devolver duas linhas, é um defeito de RLS gritando alto — melhor do que um id
 * guardado num cookie que ninguém revalida.
 */
export function useProfessionalIdentity() {
  const [identity, setIdentity] = useState<ProfessionalIdentity>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchIdentity() {
      setLoading(true);
      setError(null);
      try {
        const [prof, company] = await Promise.all([
          supabase
            .from('myia_professionals_medical')
            .select('id, nome, especialidade, registro')
            .limit(1)
            .maybeSingle(),
          supabase.from('myia_companies').select('name').limit(1).maybeSingle(),
        ]);

        if (prof.error) throw prof.error;
        if (company.error) throw company.error;
        if (cancelled) return;

        setIdentity({
          id: prof.data?.id ?? '',
          nome: prof.data?.nome ?? '',
          especialidade: prof.data?.especialidade ?? null,
          registro: prof.data?.registro ?? null,
          clinica: company.data?.name ?? null,
        });
      } catch (err: any) {
        if (cancelled) return;
        const message = describeSupabaseError(err);
        console.error('[useProfessionalIdentity] Erro ao identificar o profissional:', message, err);
        setError(message);
        setIdentity(EMPTY);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchIdentity();
    return () => {
      cancelled = true;
    };
  }, []);

  return { identity, loading, error };
}

/** "Dra. Helena Marques" -> "Dra. Helena". O cumprimento fica pessoal sem virar
 *  informal demais, e cabe numa linha em telas estreitas. */
export function shortName(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length <= 2) return nome;
  const temTitulo = /^(dr|dra|prof)\.?$/i.test(partes[0]);
  return temTitulo ? `${partes[0]} ${partes[1]}` : partes[0];
}
