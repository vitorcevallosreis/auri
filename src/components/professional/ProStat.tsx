"use client"

import { cn } from "@/lib/utils"

interface ProStatProps {
  label: string
  value: string
  footnote?: string
  className?: string
}

/**
 * Número solto num card arejado.
 *
 * Não é o StatCard do painel do dono: aquele tem caixa de ícone
 * (`rounded-lg bg-muted p-2`) e valor em `text-2xl font-bold`, uma densidade
 * pensada para oito cartões numa grade. Aqui são três por linha, com muito
 * respiro e o número como protagonista.
 *
 * `tabular-nums` para os dígitos não dançarem quando o valor muda.
 */
export function ProStat({ label, value, footnote, className }: ProStatProps) {
  return (
    <div className={cn("rounded-2xl border bg-card p-8", className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-3 text-4xl font-semibold tabular-nums">{value}</p>
      {footnote && (
        <p className="mt-2 text-xs text-muted-foreground">{footnote}</p>
      )}
    </div>
  )
}
