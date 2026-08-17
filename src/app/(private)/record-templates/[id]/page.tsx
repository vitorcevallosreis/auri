"use client"

import { Suspense } from "react"
import { useRecordTemplateEditorModel } from "./model"
import { RecordTemplateEditorView } from "./view"

/**
 * Editor de modelo. O segmento `[id]` recebe "new" para criação — nenhum id
 * real é a palavra "new", então não há ambiguidade, e criar e editar
 * compartilham o formulário inteiro em vez de duas rotas quase iguais.
 */
function Editor() {
  const model = useRecordTemplateEditorModel()
  return <RecordTemplateEditorView {...model} />
}

export default function RecordTemplateEditorPage() {
  // `useSearchParams` (o `?from=` da duplicata) exige fronteira de Suspense no
  // App Router; sem ela o build falha ao pré-renderizar a rota.
  return (
    <Suspense fallback={null}>
      <Editor />
    </Suspense>
  )
}
