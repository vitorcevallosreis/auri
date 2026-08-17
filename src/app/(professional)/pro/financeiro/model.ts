"use client"

import { useMemo, useState } from "react"
import {
  useProfessionalRevenue,
  useRevenueAppointments,
} from "@/hooks/useProfessionalRevenue"
import { clientTz, todayInTz } from "@/lib/utils/DateTime"

export type Periodo = "mes" | "trimestre" | "ano"

export const PERIODOS: { key: Periodo; label: string }[] = [
  { key: "mes", label: "Este mês" },
  { key: "trimestre", label: "Últimos 3 meses" },
  { key: "ano", label: "Este ano" },
]

/** Início do período no fuso do usuário, como "YYYY-MM-DD".
 *  Construído a partir da data local (não de `new Date()` cru) para não escorregar
 *  um dia perto da meia-noite, pelo mesmo motivo que as RPCs recebem `p_tz`. */
function inicioDoPeriodo(periodo: Periodo, hoje: string): string {
  const [ano, mes] = hoje.split("-").map(Number)
  if (periodo === "ano") return `${ano}-01-01`
  const mesesAtras = periodo === "trimestre" ? 2 : 0
  const d = new Date(Date.UTC(ano, mes - 1 - mesesAtras, 1))
  return d.toISOString().slice(0, 10)
}

export function useFinanceiroModel() {
  const [periodo, setPeriodo] = useState<Periodo>("mes")
  const { metrics, loading, error } = useProfessionalRevenue(6)

  const tz = clientTz()
  const hoje = useMemo(() => todayInTz(tz), [tz])
  const de = useMemo(() => inicioDoPeriodo(periodo, hoje), [periodo, hoje])

  const { rows, loading: loadingRows } = useRevenueAppointments(de, hoje, 100)

  // Variação mês a mês. Sem mês anterior não existe variação — mostrar "+100%"
  // contra zero seria inventar uma tendência que o dado não sustenta.
  const variacao =
    metrics.lastMonthTotal > 0
      ? Math.round(
          ((metrics.monthTotal - metrics.lastMonthTotal) / metrics.lastMonthTotal) * 100
        )
      : null

  const maiorServico = metrics.byService.reduce((max, s) => Math.max(max, s.total), 0)

  return {
    periodo,
    setPeriodo,
    metrics,
    variacao,
    maiorServico,
    rows,
    totalDoPeriodo: rows.reduce((s, r) => s + r.value, 0),
    loading,
    loadingRows,
    error,
  }
}

export type IFinanceiroModel = ReturnType<typeof useFinanceiroModel>
