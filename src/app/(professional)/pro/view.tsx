"use client"

import { ProfessionalLayout } from "@/app/layout/professional-layout"
import { ProStat } from "@/components/professional/ProStat"
import { DayTimeline } from "@/components/professional/DayTimeline"
import { Skeleton } from "@/components/ui/skeleton"
import { Sun } from "lucide-react"
import type { IMeuDiaModel } from "./model"

const hhmm = (t?: string) => (t ? t.slice(0, 5) : "--:--")

/** Arco fino marcando a posição do expediente (8h-19h) no dia.
 *
 *  É o ÚNICO lugar destas telas em que o menta aparece como traço, e a licença
 *  é a mesma que a sidebar já se dá na barra do item ativo: elemento puramente
 *  decorativo, que não carrega texto. Menta como cor de texto reprova em
 *  contraste; como forma, não. */
function ArcoDoDia({ progresso }: { progresso: number }) {
  const raio = 52
  const circunferencia = Math.PI * raio // meia volta
  const preenchido = Math.max(0, Math.min(1, progresso)) * circunferencia

  return (
    <svg viewBox="0 0 120 70" className="h-[70px] w-[120px]" aria-hidden="true">
      <path
        d="M 8 62 A 52 52 0 0 1 112 62"
        fill="none"
        stroke="currentColor"
        className="text-border"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M 8 62 A 52 52 0 0 1 112 62"
        fill="none"
        stroke="currentColor"
        className="text-accent"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${preenchido} ${circunferencia}`}
      />
    </svg>
  )
}

export function MeuDiaView(m: IMeuDiaModel) {
  const INICIO_EXPEDIENTE = 8 * 60
  const FIM_EXPEDIENTE = 19 * 60
  const progresso =
    (m.nowMinutes - INICIO_EXPEDIENTE) / (FIM_EXPEDIENTE - INICIO_EXPEDIENTE)

  return (
    <ProfessionalLayout>
      <div className="space-y-10">
        {/* Cabeçalho sem card: a saudação é a âncora da tela e não precisa de
            caixa em volta para ser encontrada. */}
        <header>
          <h1 className="text-[2rem] font-semibold leading-[1.2]">
            {m.loading && !m.nome ? (
              <Skeleton className="h-9 w-72" />
            ) : (
              `${m.saudacao}${m.nome ? `, ${m.nome}` : ""}`
            )}
          </h1>
          <p className="mt-2 text-muted-foreground first-letter:uppercase">
            {m.dataPorExtenso}
            {!m.loading && ` · ${m.metrics.todayTotal} ${m.metrics.todayTotal === 1 ? "atendimento" : "atendimentos"}`}
          </p>
        </header>

        {m.error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Não foi possível carregar seu dia: {m.error}
          </div>
        )}

        {/* Agora */}
        <section className="rounded-2xl border bg-card p-8">
          {m.loading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-64" />
              <Skeleton className="h-4 w-40" />
            </div>
          ) : m.destaque ? (
            <div className="flex flex-wrap items-center justify-between gap-8">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">
                  {m.destaqueEmCurso ? "Em atendimento" : "Próximo"}
                </p>
                <p className="mt-2 truncate text-[2rem] font-semibold leading-tight">
                  {m.destaque.patient}
                </p>
                {m.destaque.service && (
                  <p className="mt-1 truncate text-muted-foreground">
                    {m.destaque.service}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-5xl font-light tabular-nums leading-none">
                    {hhmm(m.destaque.startTime)}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    até {hhmm(m.destaque.endTime)}
                  </p>
                </div>
                <ArcoDoDia progresso={progresso} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/20">
                <Sun className="h-5 w-5" />
              </div>
              <p className="mt-4 text-lg font-medium">Dia encerrado</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Nenhum atendimento pela frente hoje.
              </p>
            </div>
          )}
        </section>

        {/* Agenda de hoje */}
        {(m.loading || m.appointments.length > 0) && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Hoje
            </h2>
            <div className="mt-4 rounded-2xl border bg-card px-6">
              {m.loading ? (
                <div className="space-y-4 py-6">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <DayTimeline
                  appointments={m.appointments}
                  nowMinutes={m.nowMinutes}
                />
              )}
            </div>
          </section>
        )}

        {/* Três números — os únicos sobre os quais um médico pode agir. */}
        <section className="grid gap-6 sm:grid-cols-3">
          <ProStat
            label="Esta semana"
            value={m.loading ? "—" : String(m.metrics.weekCompleted)}
            footnote={
              m.loading ? undefined : `de ${m.metrics.weekTotal} agendados`
            }
          />
          <ProStat
            label="Comparecimento"
            value={m.loading ? "—" : `${m.metrics.attendanceRate}%`}
            footnote="últimos 90 dias"
          />
          <ProStat
            label="Satisfação"
            value={
              m.loading
                ? "—"
                : m.metrics.ratingResponses
                  ? m.metrics.avgRating.toFixed(1).replace(".", ",")
                  : "—"
            }
            // A contagem não é enfeite: um 5,0 vindo de uma única avaliação
            // precisa parecer o que é.
            footnote={
              m.loading
                ? undefined
                : m.metrics.ratingResponses
                  ? `${m.metrics.ratingResponses} ${m.metrics.ratingResponses === 1 ? "avaliação" : "avaliações"}`
                  : "sem avaliações ainda"
            }
          />
        </section>
      </div>
    </ProfessionalLayout>
  )
}
