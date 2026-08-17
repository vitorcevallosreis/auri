"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useRecordTemplates } from "@/hooks/useMedicalRecords"
import {
  useAtendimentosSemProntuario,
  useCriarProntuario,
} from "@/hooks/useMedicalRecordWrite"
import { useProfessionalIdentity } from "@/hooks/useProfessionalIdentity"

export function useNovoProntuarioModel() {
  const router = useRouter()
  const { atendimentos, loading: loadingAppts, error: errorAppts } =
    useAtendimentosSemProntuario()
  const { templates, loading: loadingTpl } = useRecordTemplates()
  const { identity } = useProfessionalIdentity()
  const { criar, saving } = useCriarProntuario()

  const [atendimentoId, setAtendimentoId] = useState<string | null>(null)
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [busca, setBusca] = useState("")

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return atendimentos
    return atendimentos.filter((a) => a.patient.toLowerCase().includes(termo))
  }, [atendimentos, busca])

  /**
   * Modelos da especialidade do médico primeiro.
   *
   * Um cardiologista abre a lista e vê onze modelos, dos quais um é o dele.
   * Ordenar pela especialidade dele é a diferença entre escolher e procurar —
   * e não esconde nada: o resto continua logo abaixo.
   */
  const ordenados = useMemo(() => {
    const esp = identity.especialidade
    if (!esp) return templates
    return [...templates].sort((a, b) => {
      const pa = a.specialty === esp ? 0 : 1
      const pb = b.specialty === esp ? 0 : 1
      return pa - pb
    })
  }, [templates, identity.especialidade])

  // Pré-seleciona o modelo mais provável, sem decidir pelo médico: ele vê a
  // escolha marcada e troca com um clique se não for essa.
  const sugerido = ordenados[0]?.id ?? null
  const templateEfetivo = templateId ?? sugerido

  const criarProntuario = async (): Promise<{ ok: boolean; message?: string }> => {
    if (!atendimentoId || !templateEfetivo) {
      return { ok: false, message: "Escolha o atendimento e o modelo." }
    }
    const r = await criar(atendimentoId, templateEfetivo)
    if (r.ok && r.id) {
      router.push(`/pro/prontuario/${r.id}?editar=1`)
      return { ok: true }
    }
    return { ok: false, message: r.message }
  }

  return {
    atendimentos: filtrados,
    totalAtendimentos: atendimentos.length,
    templates: ordenados,
    especialidade: identity.especialidade,
    loading: loadingAppts || loadingTpl,
    error: errorAppts,
    saving,
    busca, setBusca,
    atendimentoId, setAtendimentoId,
    templateId: templateEfetivo, setTemplateId,
    criarProntuario,
  }
}

export type INovoProntuarioModel = ReturnType<typeof useNovoProntuarioModel>
