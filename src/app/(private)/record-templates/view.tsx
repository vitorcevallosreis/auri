"use client"

import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { DashboardLayout } from "@/app/layout/dashboard-layout"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { RecordFieldIcon } from "@/components/professional/RecordFieldIcon"
import {
  Search,
  Plus,
  Copy,
  Pencil,
  Archive,
  LayoutTemplate,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { RecordTemplate } from "@/hooks/useMedicalRecords"
import type { IRecordTemplatesModel } from "./model"

function ListaDeCampos({ t }: { t: RecordTemplate }) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {t.fields.length} {t.fields.length === 1 ? "campo" : "campos"}
        <ChevronDown
          className={cn("h-3 w-3 transition-transform", aberto && "rotate-180")}
          aria-hidden
        />
      </button>
      {aberto && (
        <ul className="mt-3 space-y-1.5 border-t pt-3">
          {t.fields.map((f) => (
            <li key={f.key} className="flex items-center gap-2 text-sm">
              <RecordFieldIcon name={f.icon} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span>{f.label}</span>
              {f.highlight && (
                <span className="text-xs text-muted-foreground">· destaque</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function CardModelo({
  t,
  onArquivar,
}: {
  t: RecordTemplate
  onArquivar?: (t: RecordTemplate) => void
}) {
  return (
    <section className="flex flex-col rounded-2xl border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold leading-tight">{t.name}</h3>
          {t.specialty && (
            <p className="mt-1 text-xs text-muted-foreground">{t.specialty}</p>
          )}
        </div>
        {t.isSystem ? (
          <Badge variant="outline" className="shrink-0">
            Do sistema
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0 border-accent/40 bg-accent/15">
            Desta clínica
          </Badge>
        )}
      </div>

      {t.description && (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t.description}
        </p>
      )}

      <ListaDeCampos t={t} />

      {/* Ações no fim do cartão, empurradas para baixo, para os cartões da
          mesma linha alinharem os botões mesmo com descrições de tamanhos
          diferentes. */}
      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        {t.isSystem ? (
          // Modelo do sistema não se edita — 0023 recusa no banco. A ação
          // possível é bifurcar: duplicar cria uma cópia da clínica, e é o
          // caminho pretendido de "escolha um pronto ou faça o seu".
          <Button variant="outline" size="sm" asChild>
            <Link href={`/record-templates/new?from=${t.id}`}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicar e editar
            </Link>
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/record-templates/${t.id}`}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/record-templates/new?from=${t.id}`}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicar
              </Link>
            </Button>
            {onArquivar && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Archive className="mr-2 h-4 w-4" />
                    Arquivar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Arquivar “{t.name}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Ele sai do catálogo e deixa de ser escolhido em novos
                      atendimentos. Os prontuários já escritos com este modelo
                      continuam intactos e continuam abrindo normalmente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onArquivar(t)}>
                      Arquivar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        )}
      </div>
    </section>
  )
}

export function RecordTemplatesView(m: IRecordTemplatesModel) {
  const arquivar = async (t: RecordTemplate) => {
    const r = await m.arquivar(t.id)
    if (r.ok) toast.success(`“${t.name}” foi arquivado.`)
    else if (r.message) toast.error(r.message)
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-6xl space-y-8 p-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[2rem] font-semibold leading-[1.2]">
              Modelos de prontuário
            </h1>
            <p className="mt-2 text-muted-foreground">
              Cada modelo define os campos que o profissional preenche no
              atendimento.
            </p>
          </div>
          <Button asChild>
            <Link href="/record-templates/new">
              <Plus className="mr-2 h-4 w-4" />
              Novo modelo
            </Link>
          </Button>
        </header>

        {m.error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Não foi possível carregar os modelos: {m.error}
          </div>
        )}

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={m.busca}
            onChange={(e) => m.setBusca(e.target.value)}
            placeholder="Buscar modelo ou especialidade"
            className="pl-9"
          />
        </div>

        {m.loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-52 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Modelos desta clínica
              </h2>
              {m.daClinica.length === 0 ? (
                <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/20">
                    <LayoutTemplate className="h-5 w-5" />
                  </div>
                  <p className="mt-4 font-medium">Nenhum modelo próprio ainda</p>
                  <p className="mt-1 max-w-[46ch] text-sm text-muted-foreground">
                    Comece duplicando um modelo do sistema abaixo — sai mais
                    rápido que montar do zero, e você ajusta só o que precisa.
                  </p>
                </div>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {m.daClinica.map((t) => (
                    <CardModelo key={t.id} t={t} onArquivar={arquivar} />
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Modelos do sistema
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Valem para todas as clínicas e não podem ser alterados. Duplique
                para criar uma versão sua.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {m.doSistema.map((t) => (
                  <CardModelo key={t.id} t={t} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
