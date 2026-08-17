"use client"

import { useContext, useEffect, useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { AuthContext } from "@/contexts/Auth"
import {
  useRecordTemplate,
  useRecordTemplateAdmin,
  type TemplateInput,
} from "@/hooks/useRecordTemplateAdmin"
import type { TemplateField, FieldType } from "@/hooks/useMedicalRecords"

/**
 * Chave a partir do rótulo.
 *
 * A chave é o que fica gravado dentro de cada prontuário; o rótulo é só o que
 * se lê na tela. Derivar uma da outra deixa quem monta o modelo pensando em
 * português, e não em nome de coluna — mas a derivação só acontece enquanto a
 * chave não foi tocada à mão (ver `keyTravada` abaixo), porque renomear o
 * rótulo de um campo já usado não pode mudar onde o texto está guardado.
 *
 * O formato segue o CHECK de 0023: ^[a-z][a-z0-9_]{0,39}$.
 */
export function chaveDeRotulo(rotulo: string): string {
  const base = rotulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tira acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
  // Precisa começar por letra: "3_dia" viraria chave inválida e o INSERT
  // voltaria como um 23514 genérico lá na frente.
  return /^[a-z]/.test(base) ? base : `campo_${base}`.slice(0, 40)
}

export interface CampoEditavel extends TemplateField {
  /** Id só de renderização: a chave muda enquanto se digita e não serve de key
   *  de lista — trocá-la remontaria o input e faria perder o foco a cada tecla. */
  uid: string
  /** Chave editada à mão: para de seguir o rótulo. */
  keyTravada: boolean
}

let contador = 0
const novoUid = () => `campo_${++contador}`

const campoVazio = (): CampoEditavel => ({
  uid: novoUid(),
  key: "",
  label: "",
  type: "textarea",
  icon: "file",
  keyTravada: false,
})

const paraEditavel = (f: TemplateField): CampoEditavel => ({
  ...f,
  uid: novoUid(),
  // Campo que veio do banco já tem chave definitiva. Deixá-la seguir o rótulo
  // faria uma simples correção de texto reapontar o campo para outro lugar do
  // jsonb, e o conteúdo dos prontuários antigos sumiria da tela.
  keyTravada: true,
})

export function useRecordTemplateEditorModel() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useContext(AuthContext)

  const idRota = params?.id ?? "new"
  const ehNovo = idRota === "new"
  const idOrigem = searchParams?.get("from") ?? null

  // Ao criar, o modelo carregado é a ORIGEM da duplicata (se houver); ao
  // editar, é o próprio.
  const { template, loading, error } = useRecordTemplate(ehNovo ? idOrigem : idRota)
  const { criar, atualizar, saving } = useRecordTemplateAdmin(user?.company_id)

  const [nome, setNome] = useState("")
  const [especialidade, setEspecialidade] = useState("")
  const [descricao, setDescricao] = useState("")
  const [campos, setCampos] = useState<CampoEditavel[]>([campoVazio()])
  const [carregado, setCarregado] = useState(false)

  useEffect(() => {
    if (loading || carregado) return

    if (template) {
      // Duplicata nasce com "(cópia)" no nome: sem isso o índice único de 0023
      // recusa o INSERT com um erro que não explica o que fazer.
      setNome(ehNovo ? `${template.name} (cópia)` : template.name)
      setEspecialidade(template.specialty ?? "")
      setDescricao(template.description ?? "")
      setCampos(template.fields.map(paraEditavel))
    }
    setCarregado(true)
  }, [template, loading, carregado, ehNovo])

  const atualizarCampo = (uid: string, mudanca: Partial<CampoEditavel>) => {
    setCampos((atual) =>
      atual.map((c) => {
        if (c.uid !== uid) return c
        const proximo = { ...c, ...mudanca }
        if (mudanca.label !== undefined && !c.keyTravada) {
          proximo.key = chaveDeRotulo(mudanca.label)
        }
        if (mudanca.key !== undefined) proximo.keyTravada = true
        return proximo
      })
    )
  }

  const adicionarCampo = () => setCampos((a) => [...a, campoVazio()])
  const removerCampo = (uid: string) =>
    setCampos((a) => (a.length > 1 ? a.filter((c) => c.uid !== uid) : a))

  const moverCampo = (uid: string, direcao: -1 | 1) => {
    setCampos((atual) => {
      const i = atual.findIndex((c) => c.uid === uid)
      const j = i + direcao
      if (i < 0 || j < 0 || j >= atual.length) return atual
      const copia = [...atual]
      ;[copia[i], copia[j]] = [copia[j], copia[i]]
      return copia
    })
  }

  /** Só um campo pode ser o destaque — a tela tem um único bloco de marca. */
  const definirDestaque = (uid: string) =>
    setCampos((atual) =>
      atual.map((c) => ({ ...c, highlight: c.uid === uid ? !c.highlight : false }))
    )

  /**
   * Validação no cliente, espelhando o CHECK de 0023.
   *
   * Não substitui o do banco — duplica de propósito. O banco é a garantia; isto
   * aqui é o que evita mandar uma requisição para receber de volta um
   * "23514" que não diz qual campo está errado.
   */
  const problemas = useMemo(() => {
    const lista: string[] = []
    if (!nome.trim()) lista.push("O modelo precisa de um nome.")
    if (campos.length === 0) lista.push("Inclua ao menos um campo.")

    campos.forEach((c, i) => {
      const ref = c.label.trim() || `Campo ${i + 1}`
      if (!c.label.trim()) lista.push(`${ref}: falta o rótulo.`)
      if (!/^[a-z][a-z0-9_]{0,39}$/.test(c.key)) {
        lista.push(`${ref}: a chave “${c.key}” é inválida (use letras minúsculas, números e _).`)
      }
      if (c.type === "select" && !(c.options ?? []).filter((o) => o.trim()).length) {
        lista.push(`${ref}: uma lista de opções precisa de pelo menos uma opção.`)
      }
    })

    const chaves = campos.map((c) => c.key)
    const repetidas = chaves.filter((k, i) => k && chaves.indexOf(k) !== i)
    for (const k of new Set(repetidas)) {
      lista.push(`A chave “${k}” está repetida — cada campo precisa da sua.`)
    }

    return lista
  }, [nome, campos])

  const salvar = async (): Promise<{ ok: boolean; message?: string }> => {
    if (problemas.length > 0) return { ok: false, message: problemas[0] }

    const input: TemplateInput = {
      name: nome.trim(),
      specialty: especialidade.trim() || null,
      description: descricao.trim() || null,
      fields: campos.map((c) => {
        // `uid` e `keyTravada` são estado da tela; gravá-los sujaria o jsonb
        // com coisas que só esta tela entende.
        const { uid: _uid, keyTravada: _kt, ...limpo } = c
        const campo: TemplateField = {
          ...limpo,
          label: limpo.label.trim(),
          hint: limpo.hint?.trim() || undefined,
          placeholder: limpo.placeholder?.trim() || undefined,
          options:
            limpo.type === "select"
              ? (limpo.options ?? []).map((o) => o.trim()).filter(Boolean)
              : undefined,
          highlight: limpo.highlight || undefined,
        }
        return campo
      }),
    }

    const r = ehNovo ? await criar(input) : await atualizar(idRota, input)
    if (r.ok) router.push("/record-templates")
    return r
  }

  return {
    ehNovo,
    duplicandoDe: ehNovo && idOrigem ? template?.name ?? null : null,
    ehDoSistema: !ehNovo && (template?.isSystem ?? false),
    naoEncontrado: !loading && !ehNovo && !template,
    loading,
    error,
    saving,
    nome, setNome,
    especialidade, setEspecialidade,
    descricao, setDescricao,
    campos,
    atualizarCampo,
    adicionarCampo,
    removerCampo,
    moverCampo,
    definirDestaque,
    problemas,
    salvar,
  }
}

export type IRecordTemplateEditorModel = ReturnType<typeof useRecordTemplateEditorModel>
export type { FieldType }
