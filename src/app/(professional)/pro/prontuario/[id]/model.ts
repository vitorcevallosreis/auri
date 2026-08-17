"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import {
  useMedicalRecord,
  useRecordTemplates,
  type TemplateField,
} from "@/hooks/useMedicalRecords"
import { useSalvarProntuario } from "@/hooks/useMedicalRecordWrite"
import { supabase } from "@/lib/supabase/config"

export interface ReceitaEmitida {
  id: string
  memedUuid: string
  issuedAt: string
  medicamentos: { nome?: string; posologia?: string }[]
}

/** Piso quando o modelo não veio — os mesmos cinco campos do SOAP. */
export const SOAP: TemplateField[] = [
  { key: "chief_complaint", label: "Queixa principal", type: "textarea", icon: "complaint", highlight: true },
  { key: "anamnesis", label: "Anamnese", type: "textarea", icon: "file" },
  { key: "physical_exam", label: "Exame físico", type: "textarea", icon: "stethoscope" },
  { key: "assessment", label: "Hipótese diagnóstica", type: "textarea", icon: "activity" },
  { key: "plan", label: "Conduta", type: "textarea", icon: "clipboard" },
]

export function useProntuarioDetailModel() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const id = params?.id ?? ""

  const { record, loading, error, saving: savingReview, applyReview } = useMedicalRecord(id)
  const { templates } = useRecordTemplates()
  const { salvar, saving: savingContent } = useSalvarProntuario()

  const [receitas, setReceitas] = useState<ReceitaEmitida[]>([])
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState<Record<string, string>>({})
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [abriuAutomatico, setAbriuAutomatico] = useState(false)

  // `?editar=1` vem de quem acabou de criar o prontuário: ele chega numa folha
  // em branco, e mostrar a versão de leitura primeiro seria uma tela vazia com
  // um botão. Só dispara uma vez — depois disso, quem manda é o botão.
  useEffect(() => {
    if (abriuAutomatico || loading || !record) return
    if (searchParams?.get("editar") === "1" && record.reviewStatus !== "signed") {
      abrirEdicao()
    }
    setAbriuAutomatico(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, record, abriuAutomatico])

  /**
   * Receitas emitidas neste atendimento.
   *
   * A receita vale como registro clínico: quem lê o prontuário precisa ver o
   * que foi prescrito sem sair para a Memed. O conteúdo aqui é o resumo — o
   * documento assinado continua sendo o de lá.
   */
  const recarregarReceitas = useCallback(async () => {
    if (!id) return
    const { data, error } = await supabase
      .from("myia_prescriptions")
      .select("id, memed_uuid, issued_at, medicamentos")
      .eq("medical_record_id", id)
      .order("issued_at", { ascending: false })

    if (error) {
      console.error("[prontuario] receitas:", error)
      return
    }
    setReceitas(
      (data ?? []).map((r: any) => ({
        id: r.id,
        memedUuid: r.memed_uuid,
        issuedAt: r.issued_at,
        medicamentos: Array.isArray(r.medicamentos) ? r.medicamentos : [],
      }))
    )
  }, [id])

  useEffect(() => {
    recarregarReceitas()
  }, [recarregarReceitas])

  const campos = record?.template?.fields?.length ? record.template.fields : SOAP

  function abrirEdicao() {
    if (!record) return
    // O rascunho começa com TODAS as chaves do modelo, mesmo as vazias: assim
    // apagar um campo manda string vazia, que é o que 0024 precisa receber para
    // o apagamento valer. Uma chave ausente seria "não mexi neste campo".
    const inicial: Record<string, string> = {}
    for (const c of campos) inicial[c.key] = record.content[c.key] ?? ""
    setRascunho(inicial)
    setTemplateId(record.template?.id ?? null)
    setEditando(true)
  }

  function cancelarEdicao() {
    setEditando(false)
    setRascunho({})
  }

  function mudarCampo(key: string, valor: string) {
    setRascunho((r) => ({ ...r, [key]: valor }))
  }

  /** Trocar de modelo mantém o que já foi digitado nas chaves em comum. */
  function trocarModelo(novoId: string) {
    const novo = templates.find((t) => t.id === novoId)
    setTemplateId(novoId)
    if (!novo) return
    setRascunho((atual) => {
      const proximo: Record<string, string> = {}
      for (const c of novo.fields) proximo[c.key] = atual[c.key] ?? record?.content[c.key] ?? ""
      return proximo
    })
  }

  async function salvarEdicao(): Promise<{ ok: boolean; message?: string }> {
    if (!record) return { ok: false }
    const r = await salvar(record.id, rascunho, templateId)
    if (r.ok) {
      setEditando(false)
      // Recarrega da fonte em vez de remendar o estado local: o save pode ter
      // mudado review_status (revisado volta a pendente) e mesclado com
      // conteúdo que esta tela nem conhece.
      window.location.href = `/pro/prontuario/${record.id}`
    }
    return { ok: r.ok, message: r.message }
  }

  // Campos do MODELO ESCOLHIDO durante a edição — o formulário acompanha a
  // troca de modelo antes mesmo de salvar.
  const camposEdicao = editando
    ? templates.find((t) => t.id === templateId)?.fields ?? campos
    : campos

  /**
   * Dicionário de chave → campo, juntando TODOS os modelos do catálogo.
   *
   * Serve ao conteúdo órfão: um prontuário que trocou de modelo guarda texto
   * sob chaves que o modelo atual não descreve, e sem isto a tela rotularia o
   * cartão com a chave crua — "Allergies" em português, "Past history" em vez
   * de "Antecedentes pessoais". A chave é identificador interno; nunca deveria
   * chegar aos olhos do médico.
   *
   * Primeiro modelo a definir a chave vence. Os rótulos coincidem entre
   * modelos que compartilham chave justamente porque significam a mesma coisa.
   */
  const dicionario = new Map<string, TemplateField>()
  for (const t of templates) {
    for (const f of t.fields) if (!dicionario.has(f.key)) dicionario.set(f.key, f)
  }

  return {
    record,
    loading,
    error,
    saving: savingReview,
    applyReview,
    // edição
    receitas,
    recarregarReceitas,
    editando,
    podeEditar: !!record && record.reviewStatus !== "signed",
    rascunho,
    campos: camposEdicao,
    dicionario,
    templates,
    templateId,
    savingContent,
    abrirEdicao,
    cancelarEdicao,
    mudarCampo,
    trocarModelo,
    salvarEdicao,
  }
}

export type IProntuarioDetailModel = ReturnType<typeof useProntuarioDetailModel>
