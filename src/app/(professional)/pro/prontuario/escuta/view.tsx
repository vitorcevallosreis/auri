"use client"

import Link from "next/link"
import { ProfessionalLayout } from "@/app/layout/professional-layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
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
  ArrowLeft,
  Mic,
  Pause,
  Play,
  Square,
  Check,
  Loader2,
  ShieldCheck,
  CalendarDays,
  Clock3,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { IEscutaModel } from "./model"

const dataCurta = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(
    new Date(`${iso}T12:00:00`)
  )

const relogio = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`

/** Barras reagindo ao nível do microfone. Não é enfeite: é a única prova, para
 *  quem está gravando, de que o microfone realmente capta. */
function Medidor({ nivel, ativo }: { nivel: number; ativo: boolean }) {
  return (
    <div className="flex h-10 items-end justify-center gap-1" aria-hidden>
      {[0.35, 0.6, 0.85, 1, 0.85, 0.6, 0.35].map((peso, i) => (
        <span
          key={i}
          className={cn(
            "w-1.5 rounded-full transition-all duration-100",
            ativo ? "bg-accent" : "bg-muted-foreground/30"
          )}
          style={{ height: `${Math.max(8, (ativo ? nivel : 0) * peso * 40 + 6)}px` }}
        />
      ))}
    </div>
  )
}

export function EscutaView(m: IEscutaModel) {
  const gravando = m.etapa === "gravando" || m.etapa === "pausado"

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
          <h1 className="text-[2rem] font-semibold leading-[1.2]">Escuta do prontuário</h1>
          <p className="mt-2 max-w-[60ch] text-muted-foreground">
            A IA acompanha a consulta e devolve o prontuário já redigido, para
            você revisar e assinar em vez de digitar.
          </p>
        </header>

        {m.disponivel === false && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              A escuta ainda não está configurada nesta instalação. Fale com a
              administração da clínica — o microfone fica desligado até lá.
            </p>
          </div>
        )}

        {m.erro && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {m.erro}
          </div>
        )}

        {/* ------------------------------------------------------- processando */}
        {m.etapa === "processando" ? (
          <section className="flex flex-col items-center rounded-2xl border bg-card px-6 py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
            <p className="mt-6 text-lg font-medium">Transcrevendo e redigindo</p>
            <p className="mt-2 max-w-[46ch] text-sm text-muted-foreground">
              Isto leva um instante para consultas longas. Não feche esta aba —
              o áudio está só na memória deste navegador e não foi salvo em
              lugar nenhum.
            </p>
          </section>
        ) : gravando ? (
          /* ---------------------------------------------------------- gravando */
          <section className="rounded-2xl bg-brand p-8 text-brand-foreground ring-1 ring-accent/40">
            <div className="flex flex-col items-center text-center">
              <div className="flex items-center gap-2 text-sm">
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    m.etapa === "gravando" ? "animate-pulse bg-destructive" : "bg-muted-foreground"
                  )}
                  aria-hidden
                />
                {m.etapa === "gravando" ? "Ouvindo a consulta" : "Pausado"}
              </div>

              <p className="mt-4 text-5xl font-semibold tabular-nums">{relogio(m.segundos)}</p>

              <div className="mt-6">
                <Medidor nivel={m.nivel} ativo={m.etapa === "gravando"} />
              </div>

              <p className="mt-6 max-w-[46ch] text-sm opacity-80">
                Conduza a consulta normalmente. Não é preciso ditar nada.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                {m.etapa === "gravando" ? (
                  <Button variant="secondary" onClick={m.pausar}>
                    <Pause className="mr-2 h-4 w-4" />
                    Pausar
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={m.retomar}>
                    <Play className="mr-2 h-4 w-4" />
                    Retomar
                  </Button>
                )}

                <Button onClick={m.encerrar}>
                  <Square className="mr-2 h-4 w-4" />
                  Encerrar e gerar prontuário
                </Button>

                {/* Descartar é destrutivo e irrecuperável — a consulta não se
                    regrava. Confirmação obrigatória. */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="text-brand-foreground hover:bg-white/10">
                      Descartar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Descartar esta escuta?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O áudio captado até agora é apagado e nenhum prontuário é
                        gerado. A consulta não pode ser regravada.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Continuar gravando</AlertDialogCancel>
                      <AlertDialogAction onClick={m.cancelar}>Descartar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </section>
        ) : (
          /* ----------------------------------------------------------- escolha */
          <>
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                1. Atendimento
              </h2>
              {m.loadingAtendimentos ? (
                <div className="mt-4 space-y-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-xl" />
                  ))}
                </div>
              ) : m.atendimentos.length === 0 ? (
                <p className="mt-4 rounded-2xl border bg-card px-6 py-8 text-center text-sm text-muted-foreground">
                  Nenhum atendimento sem prontuário nos últimos 30 dias.
                </p>
              ) : (
                <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto rounded-2xl border bg-card p-2">
                  {m.atendimentos.map((a) => {
                    const escolhido = m.atendimentoId === a.id
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => m.setAtendimentoId(a.id)}
                          aria-pressed={escolhido}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors",
                            escolhido ? "bg-accent/25" : "hover:bg-muted/60"
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                              escolhido ? "bg-brand text-brand-foreground" : "bg-muted"
                            )}
                            aria-hidden
                          >
                            {escolhido && <Check className="h-3.5 w-3.5" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{a.patient}</span>
                            <span className="block truncate text-sm text-muted-foreground">
                              {a.service ?? "Atendimento"}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                              {dataCurta(a.date)}
                            </span>
                            <span className="ml-3 inline-flex items-center gap-1">
                              <Clock3 className="h-3.5 w-3.5" aria-hidden />
                              {a.startTime.slice(0, 5)}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                2. Modelo do prontuário
              </h2>
              {m.especialidade && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Os de {m.especialidade} aparecem primeiro.
                </p>
              )}
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
                        escolhido ? "border-accent/60 bg-accent/20" : "bg-card hover:bg-muted/60"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium leading-tight">{t.name}</p>
                          {t.specialty && (
                            <p className="mt-1 text-xs text-muted-foreground">{t.specialty}</p>
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
            </section>

            {/* ------------------------------------------------- consentimento */}
            <section className="rounded-2xl border border-accent/40 bg-accent/15 p-6">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold leading-tight">
                    3. Consentimento do paciente
                  </h2>
                  <p className="mt-2 max-w-[62ch] text-sm text-muted-foreground">
                    Gravar uma consulta sem aceite explícito não é opção sob a
                    LGPD. O áudio é usado apenas para gerar este prontuário e{" "}
                    <strong className="font-medium text-foreground">
                      não fica armazenado
                    </strong>{" "}
                    — só a transcrição e o registro clínico permanecem.
                  </p>

                  <div className="mt-4 flex items-start gap-3">
                    <Checkbox
                      id="consentimento"
                      checked={m.consentimento}
                      onCheckedChange={(v) => m.setConsentimento(v === true)}
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor="consentimento"
                      className="cursor-pointer text-sm font-normal leading-relaxed"
                    >
                      Informei o paciente e ele consentiu com a escuta desta
                      consulta.
                    </Label>
                  </div>
                </div>
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <Button variant="outline" asChild>
                <Link href="/pro/prontuario">Cancelar</Link>
              </Button>
              <Button
                size="lg"
                onClick={m.iniciar}
                disabled={
                  m.disponivel !== true ||
                  !m.atendimentoId ||
                  !m.templateId ||
                  !m.consentimento
                }
              >
                <Mic className="mr-2 h-4 w-4" />
                Iniciar escuta
              </Button>
            </div>
          </>
        )}
      </div>
    </ProfessionalLayout>
  )
}
