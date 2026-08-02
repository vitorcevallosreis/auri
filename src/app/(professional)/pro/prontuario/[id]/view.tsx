"use client"

import Link from "next/link"
import { ProfessionalLayout } from "@/app/layout/professional-layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ReviewBadge } from "@/components/professional/RecordBadges"
import { ArrowLeft, Sparkles, ClipboardList } from "lucide-react"
import type { MedicalRecordDetail } from "@/hooks/useMedicalRecords"

const SECOES: { campo: keyof MedicalRecordDetail; titulo: string }[] = [
  { campo: "chiefComplaint", titulo: "Queixa principal" },
  { campo: "anamnesis", titulo: "Anamnese" },
  { campo: "physicalExam", titulo: "Exame físico" },
  { campo: "assessment", titulo: "Hipótese diagnóstica" },
  { campo: "plan", titulo: "Conduta" },
]

const dataLonga = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    .format(new Date(`${iso}T12:00:00`))

const dataHora = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso))

const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : null)

interface Props {
  record: MedicalRecordDetail | null
  loading: boolean
  error: string | null
}

/** Botão de ação ainda sem lógica. Desabilitado e explicado, em vez de
 *  habilitado: a escrita é de outra etapa e o RLS do profissional é somente
 *  leitura, então um clique devolveria erro. Botão que mente sobre o estado do
 *  produto é pior que botão apagado. */
function AcaoFutura({ label }: { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0}>
          <Button variant="outline" size="sm" disabled>
            {label}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>Em breve</TooltipContent>
    </Tooltip>
  )
}

export function ProntuarioDetailView({ record, loading, error }: Props) {
  if (loading) {
    return (
      <ProfessionalLayout>
        <div className="space-y-8">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </ProfessionalLayout>
    )
  }

  if (error || !record) {
    return (
      <ProfessionalLayout>
        <div className="space-y-8">
          <Link
            href="/pro/prontuario"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Prontuário
          </Link>
          <div className="flex flex-col items-center rounded-2xl border bg-card px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/20">
              <ClipboardList className="h-5 w-5" />
            </div>
            <p className="mt-4 text-lg font-medium">Prontuário não encontrado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {error ?? "Ele pode ter sido removido, ou não pertence a você."}
            </p>
          </div>
        </div>
      </ProfessionalLayout>
    )
  }

  const horario =
    hhmm(record.startTime) && hhmm(record.endTime)
      ? `${hhmm(record.startTime)} – ${hhmm(record.endTime)}`
      : null

  return (
    <ProfessionalLayout>
      <TooltipProvider delayDuration={0}>
        <div className="space-y-8">
          <Link
            href="/pro/prontuario"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Prontuário
          </Link>

          <header>
            <h1 className="text-[2rem] font-semibold leading-[1.2]">
              {record.patient}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {[dataLonga(record.recordDate), record.service, horario]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </header>

          {/* A procedência vem ANTES do conteúdo clínico, não como nota de
              rodapé. Quem abre um rascunho de IA precisa saber disso antes de
              ler — e não depois de já ter lido como se fosse texto assinado. */}
          {record.source === "ai" ? (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-accent/40 bg-accent/15 p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="text-sm">
                  <span className="font-medium">Rascunho gerado por IA</span> a
                  partir da consulta
                  {record.aiModel && ` · ${record.aiModel}`}
                  {record.aiGeneratedAt && ` · ${dataHora(record.aiGeneratedAt)}`}
                  . Revise antes de assinar.
                </p>
              </div>
              <ReviewBadge status={record.reviewStatus} />
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">
                Registro escrito manualmente.
              </p>
              <ReviewBadge status={record.reviewStatus} />
            </div>
          )}

          {/* Coluna de leitura estreita de propósito: texto clínico corrido em
              largura total vira parede e ninguém lê até o fim. */}
          <article className="space-y-8 rounded-2xl border bg-card p-8">
            {SECOES.map(({ campo, titulo }) => {
              const conteudo = record[campo] as string | null
              return (
                <section key={String(campo)}>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {titulo}
                  </h2>
                  <p className="mt-2 max-w-[68ch] leading-relaxed">
                    {conteudo || (
                      <span className="text-muted-foreground">Não registrado.</span>
                    )}
                  </p>
                </section>
              )
            })}
          </article>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              {record.signedAt
                ? `Assinado em ${dataHora(record.signedAt)}`
                : record.reviewedAt
                  ? `Revisado em ${dataHora(record.reviewedAt)}`
                  : "Ainda não revisado"}
            </p>
            <div className="flex gap-2">
              <AcaoFutura label="Marcar como revisado" />
              <AcaoFutura label="Assinar" />
            </div>
          </div>
        </div>
      </TooltipProvider>
    </ProfessionalLayout>
  )
}
