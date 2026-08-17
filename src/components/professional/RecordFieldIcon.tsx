"use client"

import {
  Activity,
  AlertTriangle,
  Check,
  ClipboardCheck,
  FileText,
  HeartPulse,
  History,
  MessageSquareQuote,
  Pill,
  Stethoscope,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

/**
 * Ícone de um campo do modelo.
 *
 * O modelo guarda um NOME (`"stethoscope"`), não um componente — ele vem do
 * banco, e um dia virá de um modelo que a própria clínica escreveu. Este mapa é
 * a fronteira: nome desconhecido cai no genérico em vez de renderizar nada e
 * deixar o cartão torto.
 *
 * Nomes curtos e de domínio ("complaint", "alert") em vez dos nomes do lucide:
 * quem escreve um modelo pensa em "isto é uma queixa", não em qual pictograma a
 * biblioteca chama assim. Trocar de biblioteca de ícones não deveria invalidar
 * os modelos gravados.
 */
const ICONES: Record<string, LucideIcon> = {
  complaint: MessageSquareQuote,
  file: FileText,
  stethoscope: Stethoscope,
  activity: Activity,
  clipboard: ClipboardCheck,
  history: History,
  users: Users,
  pill: Pill,
  alert: AlertTriangle,
  heart: HeartPulse,
  check: Check,
}

export function RecordFieldIcon({
  name,
  className,
}: {
  name?: string
  className?: string
}) {
  const Icone = (name && ICONES[name]) || FileText
  return <Icone className={className} aria-hidden />
}
