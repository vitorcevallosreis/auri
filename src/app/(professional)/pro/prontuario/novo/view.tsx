"use client"

import Link from "next/link"
import { toast } from "sonner"
import { ProfessionalLayout } from "@/app/layout/professional-layout"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { RecordFieldIcon } from "@/components/professional/RecordFieldIcon"
import {
  ArrowLeft,
  Search,
  CalendarDays,
  Clock3,
  Check,
  Loader2,
  ClipboardList,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { INovoProntuarioModel } from "./model"

const dataCurta = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    .format(new Date(`${iso}T12:00:00`))

const hhmm = (t: string) => t.slice(0, 5)

export function NovoProntuarioView(m: INovoProntuarioModel) {
  const criar = async () => {
    const r = await m.criarProntuario()
    if (!r.ok && r.message) toast.error(r.message)
  }

  return (
    <ProfessionalLayout>
      <div className="space-y-6">
        <Link
          href="/pro/prontuario"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Prontuário
        </Link>

        <header>
          <h1 className="text-[2rem] font-semibold leading-[1.2]">Novo prontuário</h1>
          <p className="mt-2 text-muted-foreground">
            Escolha o atendimento e o modelo que vai estruturar o registro.
          </p>
        </header>

        {m.error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Não foi possível carregar os atendimentos: {m.error}
          </div>
        )}

        {/* ---------------------------------------------------------- passo 1 */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              1. Atendimento
            </h2>
            {m.totalAtendimentos > 6 && (
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={m.busca}
                  onChange={(e) => m.setBusca(e.target.value)}
                  placeholder="Buscar paciente"
                  className="pl-9"
                />
              </div>
            )}
          </div>

          {m.loading ? (
            <div className="mt-4 space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : m.atendimentos.length === 0 ? (
            <div className="mt-4 flex flex-col items-center rounded-2xl border bg-card px-6 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/20">
                <ClipboardList className="h-5 w-5" />
              </div>
              <p className="mt-4 font-medium">
                {m.busca ? "Nenhum paciente com esse nome" : "Nenhum atendimento pendente"}
              </p>
              <p className="mt-1 max-w-[46ch] text-sm text-muted-foreground">
                {m.busca
                  ? "Tente outro nome."
                  : "Todos os atendimentos dos últimos 30 dias já têm prontuário."}
              </p>
            </div>
          ) : (
            // Lista com rolagem: 30 dias de agenda cheia passam de cem linhas, e
            // o passo 2 precisa continuar alcançável sem rolar a página inteira.
            <ul className="mt-4 max-h-[22rem] space-y-2 overflow-y-auto rounded-2xl border bg-card p-2">
              {m.atendimentos.map((a) => {
                const escolhido = m.atendimentoId === a.id
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => m.setAtendimentoId(a.id)}
                      aria-pressed={escolhido}
                      className={cn(
                        "flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left transition-colors",
                        escolhido ? "bg-accent/25" : "hover:bg-muted/60"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          escolhido ? "bg-brand text-brand-foreground" : "bg-muted"
                        )}
                        aria-hidden
                      >
                        {escolhido && <Check className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{a.patient}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {a.service ?? "Atendimento"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right text-sm text-muted-foreground">
                        <p className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                          {dataCurta(a.date)}
                        </p>
                        <p className="inline-flex items-center gap-1.5">
                          <Clock3 className="h-3.5 w-3.5" aria-hidden />
                          {hhmm(a.startTime)}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* ---------------------------------------------------------- passo 2 */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            2. Modelo
          </h2>
          {m.especialidade && (
            <p className="mt-1 text-sm text-muted-foreground">
              Os de {m.especialidade} aparecem primeiro.
            </p>
          )}

          {m.loading ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {m.templates.map((t) => {
                const escolhido = m.templateId === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => m.setTemplateId(t.id)}
                    aria-pressed={escolhido}
                    className={cn(
                      "flex flex-col rounded-2xl border p-5 text-left transition-colors",
                      escolhido
                        ? "border-accent/60 bg-accent/20"
                        : "bg-card hover:bg-muted/60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium leading-tight">{t.name}</p>
                        {t.specialty && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t.specialty}
                          </p>
                        )}
                      </div>
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                          escolhido ? "bg-brand text-brand-foreground" : "border"
                        )}
                        aria-hidden
                      >
                        {escolhido && <Check className="h-3.5 w-3.5" />}
                      </span>
                    </div>
                    {t.description && (
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {t.description}
                      </p>
                    )}
                    {/* Os ícones dos campos como prévia: quem escolhe modelo quer
                        saber o que vai ter de preencher, e a contagem sozinha não
                        diz isso. */}
                    <div className="mt-4 flex flex-wrap items-center gap-1.5">
                      {t.fields.slice(0, 8).map((f) => (
                        <span
                          key={f.key}
                          title={f.label}
                          className="flex h-6 w-6 items-center justify-center rounded bg-background/60"
                        >
                          <RecordFieldIcon name={f.icon} className="h-3 w-3" />
                        </span>
                      ))}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {t.fields.length} {t.fields.length === 1 ? "campo" : "campos"}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <Button variant="outline" asChild>
            <Link href="/pro/prontuario">Cancelar</Link>
          </Button>
          <Button onClick={criar} disabled={m.saving || !m.atendimentoId || !m.templateId}>
            {m.saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Abrir prontuário
          </Button>
        </div>
      </div>
    </ProfessionalLayout>
  )
}
