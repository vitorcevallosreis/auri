"use client"

import Link from "next/link"
import { ProfessionalLayout } from "@/app/layout/professional-layout"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TooltipProvider } from "@/components/ui/tooltip"
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
import { ReviewBadge } from "@/components/professional/RecordBadges"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RecordFieldIcon } from "@/components/professional/RecordFieldIcon"
import { MemedPrescricao } from "@/components/professional/MemedPrescricao"
import {
  ArrowLeft,
  Sparkles,
  ClipboardList,
  LayoutTemplate,
  Stethoscope,
  CalendarDays,
  Clock3,
  Loader2,
  Pencil,
  Pill,
} from "lucide-react"
import type {
  ReviewAction,
  ReviewStatus,
  TemplateField,
} from "@/hooks/useMedicalRecords"
import type { IProntuarioDetailModel } from "./model"

/** Transforma uma chave crua em rótulo legível, para conteúdo órfão. */
const rotuloDeChave = (k: string) =>
  k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())

const dataLonga = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    .format(new Date(`${iso}T12:00:00`))

const dataCurta = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    .format(new Date(`${iso}T12:00:00`))

const dataHora = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso))

const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : null)

/** Duas iniciais do nome — primeira e última palavra, que é como se identifica
 *  paciente em papel: "João da Silva" → JS, não JD. */
const iniciais = (nome: string) => {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return "?"
  const primeira = partes[0][0]
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ""
  return (primeira + ultima).toUpperCase()
}

type Props = IProntuarioDetailModel

/** Um campo do modelo em modo de escrita. */
function CampoForm({
  campo,
  valor,
  onChange,
}: {
  campo: TemplateField
  valor: string
  onChange: (v: string) => void
}) {
  return (
    <section className="flex flex-col rounded-2xl border bg-card p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/20">
          <RecordFieldIcon name={campo.icon} className="h-4 w-4" />
        </span>
        <Label htmlFor={`campo-${campo.key}`} className="text-base font-semibold leading-tight">
          {campo.label}
        </Label>
      </div>
      {campo.hint && (
        <p className="mt-2 text-sm text-muted-foreground">{campo.hint}</p>
      )}
      <div className="mt-4">
        {campo.type === "select" ? (
          <Select value={valor || undefined} onValueChange={onChange}>
            <SelectTrigger id={`campo-${campo.key}`}>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {(campo.options ?? []).map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : campo.type === "text" ? (
          <Input
            id={`campo-${campo.key}`}
            value={valor}
            onChange={(e) => onChange(e.target.value)}
            placeholder={campo.placeholder}
          />
        ) : (
          <Textarea
            id={`campo-${campo.key}`}
            value={valor}
            onChange={(e) => onChange(e.target.value)}
            placeholder={campo.placeholder}
            rows={5}
          />
        )}
      </div>
    </section>
  )
}

/**
 * As duas ações de revisão.
 *
 * Elas somem conforme o prontuário avança, em vez de ficarem desabilitadas:
 * "Marcar como revisado" não existe depois de revisado, e nada existe depois de
 * assinado — a RPC de 0022 recusaria, e assinado é estado terminal.
 *
 * "Assinar" pede confirmação; "revisar" não. A diferença é o que dá para
 * desfazer: revisado ainda caminha para assinado, assinado não volta. Pedir
 * confirmação nos dois treinaria o dedo a clicar "sim" sem ler, que é
 * justamente o hábito que a confirmação da assinatura precisa quebrar.
 */
function AcoesRevisao({
  status,
  saving,
  onReview,
  onSign,
}: {
  status: ReviewStatus
  saving: ReviewAction | null
  onReview: () => void
  onSign: () => void
}) {
  if (status === "signed") return null

  return (
    <div className="flex gap-2">
      {status === "pending" && (
        <Button
          variant="outline"
          size="sm"
          disabled={saving !== null}
          onClick={onReview}
        >
          {saving === "review" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Marcar como revisado
        </Button>
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" disabled={saving !== null}>
            {saving === "sign" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Assinar
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assinar este prontuário?</AlertDialogTitle>
            <AlertDialogDescription>
              A assinatura registra que o conteúdo é seu e fica com data e hora
              do servidor. Depois de assinado, o prontuário não volta a
              rascunho.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onSign}>Assinar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** Um item da grade clínica. O título vem com um selo de ícone em menta
 *  tingida — a mesma fórmula das pastilhas: menta como FUNDO, nunca como cor
 *  de texto. */
function SecaoCard({
  titulo,
  icone,
  conteudo,
  vazio,
}: {
  titulo: string
  icone?: string
  conteudo: string | null
  vazio: string
}) {
  return (
    <section className="flex flex-col rounded-2xl border bg-card p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/20">
          <RecordFieldIcon name={icone} className="h-4 w-4" />
        </span>
        <h2 className="text-base font-semibold leading-tight">{titulo}</h2>
      </div>
      {conteudo ? (
        <p className="mt-4 max-w-[68ch] whitespace-pre-line leading-relaxed">
          {conteudo}
        </p>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {vazio}
        </p>
      )}
    </section>
  )
}

export function ProntuarioDetailView(m: Props) {
  const { record, loading, error, saving, applyReview } = m

  const executar = async (action: ReviewAction) => {
    const r = await applyReview(action)
    if (r.ok) {
      toast.success(
        action === "sign" ? "Prontuário assinado." : "Prontuário marcado como revisado."
      )
    } else if (r.message) {
      toast.error(r.message)
    }
  }

  const gravar = async () => {
    const r = await m.salvarEdicao()
    if (r.ok) toast.success("Prontuário salvo.")
    else if (r.message) toast.error(r.message)
  }

  if (loading) {
    return (
      <ProfessionalLayout>
        <div className="space-y-8">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-44 w-full rounded-2xl" />
            ))}
          </div>
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

  const campos = m.campos

  /**
   * Conteúdo que existe no prontuário mas NÃO está no modelo.
   *
   * Acontece quando o modelo é editado depois de o prontuário ter sido escrito
   * — um campo removido levaria junto o texto que o médico registrou. Descartar
   * silenciosamente seria perder registro clínico; então as sobras aparecem no
   * fim, rotuladas pela própria chave.
   */
  const conhecidas = new Set(campos.map((f) => f.key))
  const sobras: TemplateField[] = Object.keys(record.content)
    .filter((k) => !conhecidas.has(k) && record.content[k])
    // O rótulo vem do catálogo sempre que algum modelo conhecer a chave; só
    // uma chave que nenhum modelo descreve cai no nome derivado.
    .map((k) => {
      const conhecido = m.dicionario.get(k)
      return (
        conhecido ?? { key: k, label: rotuloDeChave(k), type: "textarea" as const }
      )
    })

  const destaque = campos.find((f) => f.highlight)
  const grade = [...campos.filter((f) => !f.highlight), ...sobras]

  return (
    <ProfessionalLayout>
      <TooltipProvider delayDuration={0}>
        <div className="space-y-6">
          <Link
            href="/pro/prontuario"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Prontuário
          </Link>

          {/* Folha de rosto do atendimento: quem, quando, em que estado. É o
              primeiro bloco porque um prontuário aberto sem paciente na cabeça
              é texto solto. O lavado de menta vem de um gradiente sobre o card
              — a marca aparece como superfície, e o texto continua petróleo. */}
          <header className="relative overflow-hidden rounded-2xl border bg-card">
            <div
              className="absolute inset-0 bg-gradient-to-br from-accent/30 via-accent/10 to-transparent"
              aria-hidden
            />
            <div className="relative flex flex-wrap items-start justify-between gap-6 p-6 sm:p-8">
              <div className="flex min-w-0 items-start gap-4">
                <span
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand text-lg font-semibold text-brand-foreground"
                  aria-hidden
                >
                  {iniciais(record.patient)}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Prontuário · {dataCurta(record.recordDate)}
                  </p>
                  <h1 className="mt-1 truncate text-[2rem] font-semibold leading-[1.2]">
                    {record.patient}
                  </h1>
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4" aria-hidden />
                      {dataLonga(record.recordDate)}
                    </span>
                    {record.service && (
                      <span className="inline-flex items-center gap-1.5">
                        <Stethoscope className="h-4 w-4" aria-hidden />
                        {record.service}
                      </span>
                    )}
                    {horario && (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 className="h-4 w-4" aria-hidden />
                        {horario}
                      </span>
                    )}
                    {/* Qual modelo estruturou este registro. Sem isso, dois
                        prontuários com campos diferentes pareceriam
                        inconsistência, e não modelos distintos. */}
                    {record.template && (
                      <span className="inline-flex items-center gap-1.5">
                        <LayoutTemplate className="h-4 w-4" aria-hidden />
                        {record.template.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <ReviewBadge status={record.reviewStatus} />
            </div>
          </header>

          {/* A procedência vem ANTES do conteúdo clínico, não como nota de
              rodapé. Quem abre um rascunho de IA precisa saber disso antes de
              ler — e não depois de já ter lido como se fosse texto assinado. */}
          {record.source === "ai" ? (
            <div className="flex items-start gap-3 rounded-xl border border-accent/40 bg-accent/15 p-4">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p className="text-sm">
                <span className="font-medium">Rascunho gerado por IA</span> a
                partir da consulta
                {record.aiModel && ` · ${record.aiModel}`}
                {record.aiGeneratedAt && ` · ${dataHora(record.aiGeneratedAt)}`}
                . Revise antes de assinar.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">
                Registro escrito manualmente.
              </p>
            </div>
          )}

          {/* Campo de destaque, em superfície de marca: é o motivo da consulta
              e a única coisa desta tela que sai da voz do médico e entra na do
              paciente. Contraste do #F0F0F0 sobre o petróleo: 15,4:1.
              O anel de menta não é enfeite: `brand` não inverte com o tema, e
              no escuro ele coincide com `card` — sem o anel este bloco vira
              mais um cartão da grade, que é exatamente o oposto do ponto.
              Nem todo modelo tem destaque (o "Registro livre" não tem); quando
              não tem, a grade começa direto. */}
          {m.editando ? (
            <>
              {/* Trocar de modelo no meio da escrita: o que já foi digitado nas
                  chaves em comum é mantido, e o que sai do modelo continua
                  gravado — 0024 mescla em vez de substituir. */}
              <div className="rounded-xl border bg-card p-4">
                <Label htmlFor="modelo" className="text-sm">
                  Modelo
                </Label>
                <Select value={m.templateId ?? undefined} onValueChange={m.trocarModelo}>
                  <SelectTrigger id="modelo" className="mt-1.5 sm:max-w-md">
                    <SelectValue placeholder="Escolha um modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {m.templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.specialty ? ` · ${t.specialty}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {campos.map((campo) => (
                  <div
                    key={campo.key}
                    className={campo.highlight ? "sm:col-span-2" : undefined}
                  >
                    <CampoForm
                      campo={campo}
                      valor={m.rascunho[campo.key] ?? ""}
                      onChange={(v) => m.mudarCampo(campo.key, v)}
                    />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {destaque && (
                <section className="rounded-2xl bg-brand p-6 text-brand-foreground ring-1 ring-accent/40 sm:p-8">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/20">
                      <RecordFieldIcon name={destaque.icon} className="h-4 w-4" />
                    </span>
                    <h2 className="text-base font-semibold leading-tight">
                      {destaque.label}
                    </h2>
                  </div>
                  <p className="mt-4 max-w-[68ch] whitespace-pre-line leading-relaxed">
                    {record.content[destaque.key] || (
                      <span className="opacity-70">Não registrado neste atendimento.</span>
                    )}
                  </p>
                </section>
              )}

              {/* Grade de duas colunas: cada campo do modelo vira um cartão com
                  sua própria coluna de leitura, em vez de parágrafos empilhados
                  num muro de texto onde ninguém acha a conduta. */}
              <div className="grid gap-4 sm:grid-cols-2">
                {grade.map((campo) => (
                  <SecaoCard
                    key={campo.key}
                    titulo={campo.label}
                    icone={campo.icon}
                    conteudo={record.content[campo.key] ?? null}
                    // Sem repetir o rótulo: ele está no título do cartão logo
                    // acima, e interpolá-lo aqui erra a concordância na metade
                    // dos campos ("Exames complementares não registradA").
                    vazio="Não registrado neste atendimento."
                  />
                ))}
              </div>
            </>
          )}

          {/* Receitas emitidas neste atendimento. Só aparece quando existe —
              um cartão vazio "nenhuma receita" seria ruído em toda consulta
              que não prescreve nada, que é a maioria. */}
          {m.receitas.length > 0 && !m.editando && (
            <section className="rounded-2xl border bg-card p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/20">
                  <Pill className="h-4 w-4" aria-hidden />
                </span>
                <h2 className="text-base font-semibold leading-tight">
                  Receitas emitidas
                </h2>
              </div>
              <ul className="mt-4 space-y-4">
                {m.receitas.map((r) => (
                  <li key={r.id}>
                    <p className="text-xs text-muted-foreground">
                      {dataHora(r.issuedAt)} · Memed
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {r.medicamentos.map((med, i) => (
                        <li key={i} className="text-sm">
                          {med.nome}
                          {med.posologia && (
                            <span className="text-muted-foreground"> — {med.posologia}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <p className="text-xs text-muted-foreground">
              {record.signedAt
                ? `Assinado em ${dataHora(record.signedAt)}`
                : record.reviewedAt
                  ? `Revisado em ${dataHora(record.reviewedAt)}`
                  : "Ainda não revisado"}
            </p>

            {/* Escrever e revisar são momentos diferentes, então os botões não
                convivem: enquanto edita só há salvar e cancelar. Deixar
                "Assinar" ao lado de um formulário com alterações não gravadas
                seria oferecer assinar o que ainda não foi salvo. */}
            {m.editando ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={m.cancelarEdicao}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={gravar} disabled={m.savingContent}>
                  {m.savingContent && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {/* Prescrever continua disponível DEPOIS de assinado: a receita
                    é um ato à parte, e é normal o médico assinar o registro e
                    emitir a receita em seguida. */}
                <MemedPrescricao
                  paciente={{ idExterno: record.id, nome: record.patient }}
                  recordId={record.id}
                  onEmitida={m.recarregarReceitas}
                />
                {m.podeEditar && (
                  <Button variant="outline" size="sm" onClick={m.abrirEdicao}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                )}
                <AcoesRevisao
                  status={record.reviewStatus}
                  saving={saving}
                  onReview={() => executar("review")}
                  onSign={() => executar("sign")}
                />
              </div>
            )}
          </div>
        </div>
      </TooltipProvider>
    </ProfessionalLayout>
  )
}
