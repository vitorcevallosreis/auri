"use client"

import { Suspense } from "react"
import { useProntuarioDetailModel } from "./model"
import { ProntuarioDetailView } from "./view"

function Detalhe() {
  const model = useProntuarioDetailModel()
  return <ProntuarioDetailView {...model} />
}

export default function ProntuarioDetailPage() {
  // `useSearchParams` (o `?editar=1` de quem acabou de criar) exige fronteira de
  // Suspense no App Router; sem ela o build falha ao pré-renderizar a rota.
  return (
    <Suspense fallback={null}>
      <Detalhe />
    </Suspense>
  )
}
