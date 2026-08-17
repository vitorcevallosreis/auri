"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ProfessionalLayout } from "@/app/layout/professional-layout"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { RecordFieldIcon } from "@/components/professional/RecordFieldIcon"
import { ArrowLeft, LayoutTemplate, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RecordTemplate } from "@/hooks/useMedicalRecords"

interface Props {
  templates: RecordTemplate[]
  loading: boolean
  error: string | null
}

const SEM_ESPECIALIDADE = "Geral"

/**
 * Um modelo do catálogo.
 *
 * Os campos ficam ESCONDIDOS por padrão e abrem no clique. A lista inteira
 * aberta são mais de setenta linhas de rótulo numa tela cuja pergunta é "qual
 * modelo eu uso?" — o nome e a descrição respondem isso; os campos respondem a
 * pergunta seguinte, que nem sempre é feita.
 */
function ModeloCard({ t }: { t: RecordTemplate }) {
  const [aberto, setAberto] = useState(false)

  return (
    <section className="rounded-2xl border bg-card">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-start justify-between gap-4 p-6 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold leading-tight">{t.name}</h2>
            {!t.isSystem && (
              <Badge variant="outline" className="bg-accent/15 border-accent/40">
                Da clínica
              </Badge>
            )}
          </div>
          {t.description && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t.description}
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {t.fields.length} {t.fields.length === 1 ? "campo" : "campos"}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            aberto && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {aberto && (
        <ul className="border-t px-6 py-4">
          {t.fields.map((f) => (
            <li key={f.key} className="flex items-start gap-3 py-2">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/20">
                <RecordFieldIcon name={f.icon} className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{f.label}</p>
                {f.hint && (
                  <p className="text-sm text-muted-foreground">{f.hint}</p>
                )}
                {f.type === "select" && f.options && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Opções: {f.options.join(" · ")}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function ModelosView({ templates, loading, error }: Props) {
  // Agrupa por especialidade: é assim que o médico procura — ele sabe a
  // especialidade dele antes de saber o nome do modelo.
  const porEspecialidade = useMemo(() => {
    const mapa = new Map<string, RecordTemplate[]>()
    for (const t of templates) {
      const chave = t.specialty ?? SEM_ESPECIALIDADE
      const lista = mapa.get(chave) ?? []
      lista.push(t)
      mapa.set(chave, lista)
    }
    return [...mapa.entries()]
  }, [templates])

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
          <h1 className="text-[2rem] font-semibold leading-[1.2]">
            Modelos de prontuário
          </h1>
          <p className="mt-2 text-muted-foreground">
            {loading
              ? "Carregando…"
              : `${templates.length} ${templates.length === 1 ? "modelo disponível" : "modelos disponíveis"} — cada um define os campos do registro.`}
          </p>
        </header>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Não foi possível carregar os modelos: {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-2xl" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border bg-card px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/20">
              <LayoutTemplate className="h-5 w-5" />
            </div>
            <p className="mt-4 text-lg font-medium">Nenhum modelo disponível</p>
          </div>
        ) : (
          porEspecialidade.map(([especialidade, lista]) => (
            <div key={especialidade}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {especialidade}
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {lista.map((t) => (
                  <ModeloCard key={t.id} t={t} />
                ))}
              </div>
            </div>
          ))
        )}

        {/* O médico lê o catálogo; quem escreve modelo é o dono da clínica. Sem
            esta frase, um médico procuraria o botão "novo modelo" que o RLS de
            0023 não vai deixar existir para ele. */}
        <p className="text-xs text-muted-foreground">
          Modelos do sistema valem para todas as clínicas. Modelos próprios são
          criados pela administração da clínica.
        </p>
      </div>
    </ProfessionalLayout>
  )
}
