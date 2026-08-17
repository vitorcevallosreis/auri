"use client"

import { useEffect, useState } from "react"
import {
  useMedicalRecords,
  PAGE_SIZE,
  type ReviewStatus,
} from "@/hooks/useMedicalRecords"

export type FiltroStatus = ReviewStatus | "all"

export const ABAS: { key: FiltroStatus; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "pending", label: "Aguardando revisão" },
  { key: "reviewed", label: "Revisados" },
  { key: "signed", label: "Assinados" },
]

export function useProntuarioListModel() {
  const [status, setStatus] = useState<FiltroStatus>("all")
  const [page, setPage] = useState(0)
  const [busca, setBusca] = useState("")
  const [buscaAplicada, setBuscaAplicada] = useState("")

  // Debounce: sem ele cada tecla dispara uma consulta paginada com count exato,
  // e a lista pisca enquanto se digita.
  useEffect(() => {
    const id = setTimeout(() => setBuscaAplicada(busca), 350)
    return () => clearTimeout(id)
  }, [busca])

  // Voltar para a primeira página ao trocar de filtro: ficar na página 4 de um
  // recorte que só tem 2 mostraria uma lista vazia sem explicação.
  useEffect(() => {
    setPage(0)
  }, [status, buscaAplicada])

  const { records, total, loading, error } = useMedicalRecords(
    status,
    page,
    buscaAplicada
  )

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return {
    records,
    total,
    loading,
    error,
    status,
    setStatus,
    busca,
    setBusca,
    page,
    setPage,
    totalPaginas,
  }
}

export type IProntuarioListModel = ReturnType<typeof useProntuarioListModel>
