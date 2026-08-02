"use client"

import Link from "next/link"
import { ProfessionalLayout } from "@/app/layout/professional-layout"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { SourceBadge, ReviewBadge } from "@/components/professional/RecordBadges"
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Mic,
  LayoutTemplate,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ABAS, type IProntuarioListModel } from "./model"

const dataCurta = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    .format(new Date(`${iso}T12:00:00`))

/** Primeira e última palavra do nome — mesma regra do detalhe. */
const iniciais = (nome: string) => {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return "?"
  const primeira = partes[0][0]
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ""
  return (primeira + ultima).toUpperCase()
}

export function ProntuarioListView(m: IProntuarioListModel) {
  return (
    <ProfessionalLayout>
      <div className="space-y-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[2rem] font-semibold leading-[1.2]">Prontuário</h1>
            <p className="mt-2 text-muted-foreground">
              {m.loading
                ? "Carregando…"
                : `${m.total} ${m.total === 1 ? "atendimento registrado" : "atendimentos registrados"}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/pro/prontuario/modelos"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <LayoutTemplate className="h-4 w-4" />
              Modelos
            </Link>
            <Button asChild>
              <Link href="/pro/prontuario/novo">
                <Plus className="mr-2 h-4 w-4" />
                Novo prontuário
              </Link>
            </Button>
          </div>
        </header>

        {/* Porta de entrada da escuta assistida. Fica ACIMA dos filtros porque
            é a única ação de escrita desta tela — tudo abaixo é consulta ao que
            já aconteceu. O cartão inteiro é o link; o "Iniciar" é affordance
            visual, não um segundo elemento focável dentro do mesmo alvo. */}
        <Link
          href="/pro/prontuario/escuta"
          className="group flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-accent/40 bg-accent/15 p-5 transition-colors hover:bg-accent/25"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground">
              <Mic className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="font-medium">Iniciar a escuta do prontuário</p>
              <p className="text-sm text-muted-foreground">
                A IA acompanha a consulta e redige o rascunho para você revisar.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-medium">
            Iniciar
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>

        {m.error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Não foi possível carregar os prontuários: {m.error}
          </div>
        )}

        {/* Dois controles, só. Filtrar por estado de revisão e achar um paciente
            cobrem o que um médico faz aqui; qualquer coisa além disso seria
            barra de ferramentas de sistema de gestão. */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-1">
            {ABAS.map((aba) => (
              <button
                key={aba.key}
                onClick={() => m.setStatus(aba.key)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm transition-colors",
                  m.status === aba.key
                    ? "bg-accent/25 font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {aba.label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={m.busca}
              onChange={(e) => m.setBusca(e.target.value)}
              placeholder="Buscar paciente"
              className="pl-9"
            />
          </div>
        </div>

        <div className="rounded-2xl border bg-card">
          {m.loading ? (
            <div className="space-y-4 p-6">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : m.records.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/20">
                <ClipboardList className="h-5 w-5" />
              </div>
              <p className="mt-4 text-lg font-medium">Nenhum prontuário aqui</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {m.busca
                  ? "Nenhum paciente com esse nome neste filtro."
                  : "Os prontuários aparecem conforme os atendimentos são concluídos."}
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {m.records.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/pro/prontuario/${r.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4 transition-colors hover:bg-muted/60"
                  >
                    {/* Mesmo selo de iniciais da folha de rosto do detalhe: a
                        linha e a tela que ela abre passam a se reconhecer. */}
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-sm font-medium"
                      aria-hidden
                    >
                      {iniciais(r.patient)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.patient}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {[dataCurta(r.recordDate), r.service].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <SourceBadge source={r.source} />
                      <ReviewBadge status={r.reviewStatus} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {m.totalPaginas > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Página {m.page + 1} de {m.totalPaginas}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={m.page === 0}
                onClick={() => m.setPage(m.page - 1)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={m.page + 1 >= m.totalPaginas}
                onClick={() => m.setPage(m.page + 1)}
              >
                Próxima
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </ProfessionalLayout>
  )
}
