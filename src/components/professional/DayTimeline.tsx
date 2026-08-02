"use client"

import { cn } from "@/lib/utils"
import type { TodayAppointment } from "@/hooks/useProfessionalDay"

const hhmm = (t: string) => (t ? t.slice(0, 5) : "--:--")

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
  rescheduled: "Reagendado",
}

const STATUS_CLASS: Record<string, string> = {
  completed:
    "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  no_show: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  rescheduled:
    "bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300",
}

/**
 * A agenda de hoje como linha do tempo, não tabela.
 *
 * É a visualização desta tela — por isso não há gráfico nenhum em "Meu Dia".
 * Um canvas de 300px comeria justamente o respiro que define a página, para
 * dizer menos do que estas linhas dizem.
 *
 * O atendimento em curso ganha um filete de menta à esquerda; os já passados
 * caem para 60% de opacidade. Assim o olho encontra "onde estou" sem precisar
 * ler hora nenhuma.
 */
export function DayTimeline({
  appointments,
  nowMinutes,
}: {
  appointments: TodayAppointment[]
  nowMinutes: number
}) {
  const toMinutes = (t: string) => {
    const [h, m] = (t ?? "0:0").split(":")
    return Number(h) * 60 + Number(m)
  }

  return (
    <ol className="divide-y">
      {appointments.map((a) => {
        const inicio = toMinutes(a.startTime)
        const fim = toMinutes(a.endTime)
        const emCurso = nowMinutes >= inicio && nowMinutes < fim && a.status !== "cancelled"
        const passou = fim <= nowMinutes

        return (
          <li
            key={a.id}
            className={cn(
              "flex items-center gap-5 py-4 pl-4 -ml-4 border-l-2 border-transparent",
              emCurso && "border-accent",
              passou && !emCurso && "opacity-60"
            )}
          >
            <span className="w-14 shrink-0 text-sm tabular-nums text-muted-foreground">
              {hhmm(a.startTime)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{a.patient}</p>
              {a.service && (
                <p className="truncate text-sm text-muted-foreground">{a.service}</p>
              )}
            </div>
            {a.status !== "scheduled" && (
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                  STATUS_CLASS[a.status] ?? "bg-muted text-muted-foreground"
                )}
              >
                {STATUS_LABEL[a.status] ?? a.status}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
