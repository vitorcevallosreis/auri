"use client"

import { useEffect, useState } from "react"
import { useProfessionalDay } from "@/hooks/useProfessionalDay"
import { useProfessionalIdentity, shortName } from "@/hooks/useProfessionalIdentity"
import type { TodayAppointment } from "@/hooks/useProfessionalDay"

const toMinutes = (t: string) => {
  const [h, m] = (t ?? "0:0").split(":")
  return Number(h) * 60 + Number(m)
}

function saudacao(hora: number): string {
  if (hora < 12) return "Bom dia"
  if (hora < 18) return "Boa tarde"
  return "Boa noite"
}

export function useMeuDiaModel() {
  const { identity, loading: loadingIdentity } = useProfessionalIdentity()
  const { metrics, appointments, loading, error } = useProfessionalDay()

  // O relógio precisa avançar sozinho: quem deixa a tela aberta durante o
  // expediente veria "Agora" congelado no paciente das 8h a tarde inteira.
  // Um minuto de granularidade basta — a agenda é marcada em quartos de hora.
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const nowMinutes = agora.getHours() * 60 + agora.getMinutes()

  const ativos = appointments.filter((a) => a.status !== "cancelled")

  // "Agora" é o atendimento em curso; se não há nenhum, o próximo do dia. Os
  // dois casos merecem o mesmo card porque respondem à mesma pergunta — o que
  // eu tenho pela frente.
  const emCurso: TodayAppointment | undefined = ativos.find(
    (a) => nowMinutes >= toMinutes(a.startTime) && nowMinutes < toMinutes(a.endTime)
  )
  const proximo: TodayAppointment | undefined = ativos.find(
    (a) => toMinutes(a.startTime) > nowMinutes
  )
  const destaque = emCurso ?? proximo

  const restantes = ativos.filter((a) => toMinutes(a.endTime) > nowMinutes).length

  const dataPorExtenso = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(agora)

  return {
    nome: identity.nome ? shortName(identity.nome) : "",
    especialidade: identity.especialidade,
    clinica: identity.clinica,
    saudacao: saudacao(agora.getHours()),
    dataPorExtenso,
    metrics,
    appointments,
    destaque,
    destaqueEmCurso: Boolean(emCurso),
    restantes,
    nowMinutes,
    loading: loading || loadingIdentity,
    error,
  }
}

export type IMeuDiaModel = ReturnType<typeof useMeuDiaModel>
