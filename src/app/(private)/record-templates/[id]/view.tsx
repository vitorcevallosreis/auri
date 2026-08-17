"use client"

import Link from "next/link"
import { toast } from "sonner"
import { DashboardLayout } from "@/app/layout/dashboard-layout"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RecordFieldIcon } from "@/components/professional/RecordFieldIcon"
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Star,
  Loader2,
  LayoutTemplate,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { CampoEditavel, IRecordTemplateEditorModel } from "./model"

/** Os mesmos nomes que RecordFieldIcon conhece. Quem monta o modelo escolhe
 *  pelo desenho, então a lista mostra o ícone junto do rótulo. */
const ICONES = [
  { valor: "complaint", rotulo: "Queixa" },
  { valor: "file", rotulo: "Texto" },
  { valor: "stethoscope", rotulo: "Exame" },
  { valor: "activity", rotulo: "Sinais / avaliação" },
  { valor: "clipboard", rotulo: "Conduta" },
  { valor: "history", rotulo: "Histórico" },
  { valor: "users", rotulo: "Família" },
  { valor: "pill", rotulo: "Medicação" },
  { valor: "alert", rotulo: "Alerta" },
  { valor: "heart", rotulo: "Cardio / vida" },
  { valor: "check", rotulo: "Confirmação" },
]

const TIPOS = [
  { valor: "textarea", rotulo: "Texto longo", ajuda: "Várias linhas — anamnese, conduta." },
  { valor: "text", rotulo: "Texto curto", ajuda: "Uma linha — peso, pressão." },
  { valor: "select", rotulo: "Lista de opções", ajuda: "Escolha entre valores fixos." },
]

function CampoEditor({
  campo,
  indice,
  total,
  m,
}: {
  campo: CampoEditavel
  indice: number
  total: number
  m: IRecordTemplateEditorModel
}) {
  return (
    <li className="rounded-2xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/20">
            <RecordFieldIcon name={campo.icon} className="h-4 w-4" />
          </span>
          <span className="text-sm text-muted-foreground">Campo {indice + 1}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Mover para cima"
            disabled={indice === 0}
            onClick={() => m.moverCampo(campo.uid, -1)}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Mover para baixo"
            disabled={indice === total - 1}
            onClick={() => m.moverCampo(campo.uid, 1)}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remover campo"
            disabled={total === 1}
            onClick={() => m.removerCampo(campo.uid)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor={`${campo.uid}-label`}>Rótulo</Label>
          <Input
            id={`${campo.uid}-label`}
            value={campo.label}
            onChange={(e) => m.atualizarCampo(campo.uid, { label: e.target.value })}
            placeholder="Ex.: Hipótese diagnóstica"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor={`${campo.uid}-tipo`}>Tipo</Label>
          <Select
            value={campo.type}
            onValueChange={(v) => m.atualizarCampo(campo.uid, { type: v as any })}
          >
            <SelectTrigger id={`${campo.uid}-tipo`} className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS.map((t) => (
                <SelectItem key={t.valor} value={t.valor}>
                  {t.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {TIPOS.find((t) => t.valor === campo.type)?.ajuda}
          </p>
        </div>

        <div>
          <Label htmlFor={`${campo.uid}-icone`}>Ícone</Label>
          <Select
            value={campo.icon ?? "file"}
            onValueChange={(v) => m.atualizarCampo(campo.uid, { icon: v })}
          >
            <SelectTrigger id={`${campo.uid}-icone`} className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ICONES.map((i) => (
                <SelectItem key={i.valor} value={i.valor}>
                  <span className="flex items-center gap-2">
                    <RecordFieldIcon name={i.valor} className="h-4 w-4" />
                    {i.rotulo}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {campo.type === "select" && (
          <div className="sm:col-span-2">
            <Label htmlFor={`${campo.uid}-opcoes`}>Opções</Label>
            <Textarea
              id={`${campo.uid}-opcoes`}
              value={(campo.options ?? []).join("\n")}
              onChange={(e) =>
                m.atualizarCampo(campo.uid, { options: e.target.value.split("\n") })
              }
              placeholder={"Uma por linha\nEm dia\nAtrasada"}
              rows={4}
              className="mt-1.5"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Uma opção por linha.
            </p>
          </div>
        )}

        <div className="sm:col-span-2">
          <Label htmlFor={`${campo.uid}-hint`}>Ajuda (opcional)</Label>
          <Input
            id={`${campo.uid}-hint`}
            value={campo.hint ?? ""}
            onChange={(e) => m.atualizarCampo(campo.uid, { hint: e.target.value })}
            placeholder="Aparece abaixo do rótulo, lembrando o que registrar aqui"
            className="mt-1.5"
          />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor={`${campo.uid}-key`}>Chave</Label>
          <Input
            id={`${campo.uid}-key`}
            value={campo.key}
            onChange={(e) => m.atualizarCampo(campo.uid, { key: e.target.value })}
            className="mt-1.5 font-mono text-sm"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            É onde o texto fica guardado dentro do prontuário. Sai do rótulo
            sozinha — mude só se souber por quê, e nunca em modelo já em uso:
            prontuários antigos deixariam de mostrar este campo.
          </p>
        </div>
      </div>

      <div className="mt-4 border-t pt-4">
        <Button
          type="button"
          variant={campo.highlight ? "default" : "outline"}
          size="sm"
          onClick={() => m.definirDestaque(campo.uid)}
        >
          <Star className={cn("mr-2 h-4 w-4", campo.highlight && "fill-current")} />
          {campo.highlight ? "É o campo de destaque" : "Marcar como destaque"}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          O destaque abre o prontuário num bloco próprio, acima dos demais.
          Só um campo por modelo.
        </p>
      </div>
    </li>
  )
}

export function RecordTemplateEditorView(m: IRecordTemplateEditorModel) {
  const salvar = async () => {
    const r = await m.salvar()
    if (r.ok) toast.success("Modelo salvo.")
    else if (r.message) toast.error(r.message)
  }

  if (m.loading) {
    return (
      <DashboardLayout>
        <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      </DashboardLayout>
    )
  }

  if (m.naoEncontrado) {
    return (
      <DashboardLayout>
        <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
          <Link
            href="/record-templates"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Modelos
          </Link>
          <div className="flex flex-col items-center rounded-2xl border bg-card px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/20">
              <LayoutTemplate className="h-5 w-5" />
            </div>
            <p className="mt-4 text-lg font-medium">Modelo não encontrado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ele pode ter sido arquivado, ou não pertence a esta clínica.
            </p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
        <Link
          href="/record-templates"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Modelos
        </Link>

        <header>
          <h1 className="text-[2rem] font-semibold leading-[1.2]">
            {m.ehNovo ? "Novo modelo" : "Editar modelo"}
          </h1>
          {m.duplicandoDe && (
            <p className="mt-2 text-muted-foreground">
              Cópia de “{m.duplicandoDe}”. O original continua intacto.
            </p>
          )}
        </header>

        {/* Um modelo do sistema não chega aqui pelo botão certo, mas chega pela
            URL. Avisar antes é melhor que deixar preencher tudo e tomar a
            recusa do RLS no salvar. */}
        {m.ehDoSistema && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Este é um modelo do sistema e não pode ser alterado. Volte e use
            “Duplicar e editar” para criar uma versão desta clínica.
          </div>
        )}

        <section className="space-y-4 rounded-2xl border bg-card p-6">
          <div>
            <Label htmlFor="nome">Nome do modelo</Label>
            <Input
              id="nome"
              value={m.nome}
              onChange={(e) => m.setNome(e.target.value)}
              placeholder="Ex.: Consulta de retorno — Ortopedia"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="especialidade">Especialidade (opcional)</Label>
            <Input
              id="especialidade"
              value={m.especialidade}
              onChange={(e) => m.setEspecialidade(e.target.value)}
              placeholder="Ex.: Ortopedia"
              className="mt-1.5"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Agrupa o modelo na lista do profissional.
            </p>
          </div>
          <div>
            <Label htmlFor="descricao">Descrição (opcional)</Label>
            <Textarea
              id="descricao"
              value={m.descricao}
              onChange={(e) => m.setDescricao(e.target.value)}
              placeholder="Uma frase sobre quando usar este modelo."
              rows={2}
              className="mt-1.5"
            />
          </div>
        </section>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Campos ({m.campos.length})
            </h2>
            <Button type="button" variant="outline" size="sm" onClick={m.adicionarCampo}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar campo
            </Button>
          </div>
          <ol className="mt-4 space-y-4">
            {m.campos.map((c, i) => (
              <CampoEditor
                key={c.uid}
                campo={c}
                indice={i}
                total={m.campos.length}
                m={m}
              />
            ))}
          </ol>
        </div>

        {m.problemas.length > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
            <p className="font-medium">Falta ajustar antes de salvar:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {m.problemas.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" asChild>
            <Link href="/record-templates">Cancelar</Link>
          </Button>
          <Button
            onClick={salvar}
            disabled={m.saving || m.problemas.length > 0 || m.ehDoSistema}
          >
            {m.saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {m.ehNovo ? "Criar modelo" : "Salvar alterações"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  )
}
