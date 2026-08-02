"use client"

import { ProfessionalLayout } from "@/app/layout/professional-layout"
import { ProStat } from "@/components/professional/ProStat"
import { InteractionsChart } from "@/components/dashboard/InteractionsChart"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { PERIODOS, type IFinanceiroModel } from "./model"

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

/** "2026-08" -> "Ago". O rótulo acompanha o que o banco devolveu; fixá-lo no
 *  código faria o gráfico mentir sobre qual mês é cada barra. */
const rotuloMes = (yyyyMM: string) => MESES[Number(yyyyMM.split("-")[1]) - 1] ?? yyyyMM

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

const dataCurta = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" })
    .format(new Date(`${iso}T12:00:00`))

export function FinanceiroView(m: IFinanceiroModel) {
  return (
    <ProfessionalLayout>
      <div className="space-y-10">
        <header>
          <h1 className="text-[2rem] font-semibold leading-[1.2]">Meu Financeiro</h1>
          {/* A escolha da palavra não é estilo: `valor_cobrado` é o que a CLÍNICA
              cobrou pela consulta, e não existe coluna de repasse no schema.
              Chamar de "seus ganhos" daria um número errado por um fator que
              ninguém sabe. */}
          <p className="mt-2 text-muted-foreground">
            Valor dos atendimentos que você realizou
          </p>
        </header>

        {m.error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Não foi possível carregar seus números: {m.error}
          </div>
        )}

        {/* Número herói */}
        <section className="rounded-2xl border bg-card p-8">
          <p className="text-sm text-muted-foreground">Este mês</p>
          {m.loading ? (
            <Skeleton className="mt-3 h-14 w-64" />
          ) : (
            <div className="mt-3 flex flex-wrap items-baseline gap-4">
              <p className="text-5xl font-semibold tabular-nums leading-none">
                {brl(m.metrics.monthTotal)}
              </p>
              {m.variacao !== null && (
                <span
                  className={cn(
                    "text-sm font-medium",
                    // Par medido: o tom 600 sozinho reprova em contraste num dos
                    // dois temas (verde no claro, vermelho no escuro).
                    m.variacao >= 0
                      ? "text-green-700 dark:text-green-400"
                      : "text-red-700 dark:text-red-400"
                  )}
                >
                  {m.variacao > 0 ? "+" : ""}
                  {m.variacao}% vs. mês anterior
                </span>
              )}
            </div>
          )}
        </section>

        <section className="grid gap-6 sm:grid-cols-2">
          <ProStat
            label="Atendimentos no mês"
            value={m.loading ? "—" : String(m.metrics.monthCount)}
            footnote="somente os concluídos"
          />
          <ProStat
            label="Ticket médio"
            value={m.loading ? "—" : brl(m.metrics.avgTicket)}
            footnote="no mês corrente"
          />
        </section>

        {!m.loading && m.metrics.monthly.length > 0 && (
          <section>
            <InteractionsChart
              data={m.metrics.monthly.map((x) => x.total)}
              labels={m.metrics.monthly.map((x) => rotuloMes(x.month))}
              title="Receita por mês"
              type="bar"
            />
          </section>
        )}

        {!m.loading && m.metrics.byService.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Por serviço, este mês
            </h2>
            <div className="mt-4 space-y-5 rounded-2xl border bg-card p-8">
              {m.metrics.byService.map((s) => (
                <div key={s.service} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="min-w-0 truncate font-medium">{s.service}</p>
                    <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {s.count} · {brl(s.total)}
                    </p>
                  </div>
                  <Progress
                    value={m.maiorServico ? (s.total / m.maiorServico) * 100 : 0}
                    className="h-1.5"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Atendimentos
            </h2>
            <div className="flex flex-wrap gap-1">
              {PERIODOS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => m.setPeriodo(p.key)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm transition-colors",
                    m.periodo === p.key
                      ? "bg-accent/25 font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border bg-card">
            {m.loadingRows ? (
              <div className="space-y-4 p-6">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : m.rows.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                Nenhum atendimento concluído neste período.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Data</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {m.rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {dataCurta(r.date)}
                      </TableCell>
                      <TableCell className="font-medium">{r.patient}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.service ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {brl(r.value)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={3} className="font-medium">
                      Total exibido
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {brl(m.totalDoPeriodo)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </div>
          {m.rows.length >= 100 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Exibindo os 100 atendimentos mais recentes do período.
            </p>
          )}
        </section>
      </div>
    </ProfessionalLayout>
  )
}
