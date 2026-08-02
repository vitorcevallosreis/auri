"use client"

import { Badge } from "@/components/ui/badge"
import { Sparkles, Check, Clock } from "lucide-react"
import type { ReviewStatus, RecordSource } from "@/hooks/useMedicalRecords"

/**
 * Procedência do prontuário.
 *
 * Quando veio da IA, a pastilha usa a fórmula de menta já consagrada no
 * projeto: menta como FUNDO tingido com texto em foreground, nunca como cor de
 * texto (menta é claro demais — texto branco sobre ele dá 1,6:1). É o único
 * lugar destas telas que ganha destaque de marca, e é de propósito: é a coisa
 * que o médico precisa notar antes de ler o conteúdo.
 *
 * Quando foi escrito por gente, NÃO renderiza nada. Ausência significa autoria
 * humana; uma segunda pastilha para o caso normal seria só ruído.
 */
export function SourceBadge({ source }: { source: RecordSource }) {
  if (source !== "ai") return null
  return (
    <Badge
      variant="outline"
      className="gap-1 bg-accent/15 text-foreground border-accent/40"
    >
      <Sparkles className="h-3 w-3" />
      Rascunho da IA
    </Badge>
  )
}

const REVIEW: Record<
  ReviewStatus,
  { label: string; className: string; icon?: React.ReactNode }
> = {
  // Pares de cor na regra do projeto: tom 100/800 no claro, 500/15 e 300 no
  // escuro. O tom 600 sozinho reprova em contraste num dos dois temas.
  pending: {
    label: "Aguardando revisão",
    className:
      "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
    icon: <Clock className="h-3 w-3" />,
  },
  reviewed: {
    label: "Revisado",
    className:
      "bg-secondary text-secondary-foreground border-transparent",
  },
  signed: {
    label: "Assinado",
    className:
      "bg-green-100 text-green-800 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30",
    icon: <Check className="h-3 w-3" />,
  },
}

/** Estado de revisão. Sempre presente — os três estados têm peso diferente e
 *  nenhum deles é o "normal" que poderia ficar implícito. */
export function ReviewBadge({ status }: { status: ReviewStatus }) {
  const s = REVIEW[status] ?? REVIEW.pending
  return (
    <Badge variant="outline" className={`gap-1 ${s.className}`}>
      {s.icon}
      {s.label}
    </Badge>
  )
}
