"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Pill, Loader2 } from "lucide-react"
import { authedFetch } from "@/lib/api/authedFetch"

/**
 * Prescrição digital via Memed.
 *
 * O módulo deles é um script global que injeta uma UI própria por cima da
 * página e se comunica por um objeto `MdHub` em `window`. Toda a esquisitice
 * disso — script com `data-token`, evento de inicialização, comandos
 * assíncronos — fica confinada neste arquivo.
 *
 * O que sai daqui para o resto do app é um botão e um callback quando a
 * receita é emitida.
 */

declare global {
  interface Window {
    MdHub?: {
      command: { send: (modulo: string, comando: string, dados?: unknown) => Promise<unknown> }
      module: { show: (modulo: string) => Promise<unknown> }
      event: { add: (evento: string, cb: (dados: any) => void) => void }
      server?: { unbindEvents?: () => void }
    }
  }
}

export interface PacienteMemed {
  idExterno: string
  nome: string
  telefone?: string | null
  email?: string | null
  cpf?: string | null
  data_nascimento?: string | null
}

type Estado =
  | { fase: "carregando" }
  | {
      fase: "indisponivel"
      motivo: string
      /** Faltas que SÃO a causa — a tela manda completar o cadastro. */
      dadosFaltando: string[]
      /** Faltas que existem mas não causaram este erro — vão como observação. */
      cadastroIncompleto: string[]
    }
  | { fase: "pronto" }
  | { fase: "abrindo" }

export function MemedPrescricao({
  paciente,
  recordId,
  onEmitida,
}: {
  paciente: PacienteMemed
  recordId?: string | null
  onEmitida?: () => void
}) {
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" })
  const moduloPronto = useRef(false)
  const scriptRef = useRef<HTMLScriptElement | null>(null)

  const registrar = useCallback(
    async (dados: any) => {
      try {
        const p = dados?.prescricao ?? {}
        await authedFetch("/api/prontuario/prescricao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            memedUuid: dados?.prescriptionUuid ?? p?.id,
            memedId: p?.id ?? null,
            recordId: recordId ?? null,
            medicamentos: p?.medicamentos ?? [],
            documentos: p?.documents ?? [],
          }),
        })
        toast.success("Receita emitida e registrada no prontuário.")
        onEmitida?.()
      } catch (err) {
        console.error("[memed] registro:", err)
        // A receita EXISTE na Memed — o paciente já a recebeu. Falhar aqui é
        // perder o vínculo com o prontuário, não a receita; a mensagem precisa
        // dizer isso, senão o médico prescreve de novo e emite duplicata.
        toast.error(
          "A receita foi emitida na Memed, mas não consegui vinculá-la ao prontuário."
        )
      }
    },
    [recordId, onEmitida]
  )

  useEffect(() => {
    let cancelado = false

    ;(async () => {
      try {
        const resp = await authedFetch("/api/prontuario/prescricao")
        const json = await resp.json()
        if (cancelado) return

        if (!json?.disponivel) {
          setEstado({
            fase: "indisponivel",
            motivo:
              json?.erro ??
              (json?.motivo === "nao_configurada"
                ? "A prescrição digital não está configurada nesta instalação."
                : "A prescrição digital está indisponível."),
            dadosFaltando: json?.dadosFaltando ?? [],
            cadastroIncompleto: json?.cadastroIncompleto ?? [],
          })
          return
        }

        // O script é injetado uma vez por montagem e removido no desmonte. O
        // token vai no atributo porque é assim que o módulo o lê — não há API
        // para passá-lo depois.
        const script = document.createElement("script")
        script.src = json.scriptUrl
        script.type = "text/javascript"
        script.dataset.token = json.token
        script.dataset.color = "#11282C" // petróleo da marca
        document.body.appendChild(script)
        scriptRef.current = script

        // `core:moduleInit` é o sinal de que `MdHub` existe e aceita comandos.
        // Mandar `setPaciente` antes disso é o erro clássico da integração.
        const aoIniciar = (ev: any) => {
          if (ev?.detail?.module?.name !== "plataforma.prescricao") return
          moduloPronto.current = true
          if (!cancelado) setEstado({ fase: "pronto" })
          window.MdHub?.event.add("prescricaoImpressa", registrar)
        }
        document.addEventListener("core:moduleInit", aoIniciar as EventListener)

        return () => document.removeEventListener("core:moduleInit", aoIniciar as EventListener)
      } catch (err) {
        console.error("[memed] preparo:", err)
        if (!cancelado) {
          setEstado({
            fase: "indisponivel",
            motivo: "Não foi possível preparar a prescrição.",
            dadosFaltando: [],
            cadastroIncompleto: [],
          })
        }
      }
    })()

    return () => {
      cancelado = true
      try {
        window.MdHub?.server?.unbindEvents?.()
      } catch {}
      scriptRef.current?.remove()
      scriptRef.current = null
      moduloPronto.current = false
    }
  }, [registrar])

  async function abrir(sexo: "M" | "F") {
    if (!moduloPronto.current || !window.MdHub) return
    setEstado({ fase: "abrindo" })
    try {
      await window.MdHub.command.send("plataforma.prescricao", "setPaciente", {
        ...paciente,
        sexo,
      })
      await window.MdHub.module.show("plataforma.prescricao")
    } catch (err) {
      console.error("[memed] abrir:", err)
      toast.error("Não foi possível abrir a prescrição.")
    } finally {
      setEstado({ fase: "pronto" })
    }
  }

  if (estado.fase === "indisponivel") {
    return (
      <p className="text-xs text-muted-foreground">
        {estado.motivo}
        {estado.dadosFaltando.length > 0 && (
          <> Peça à administração da clínica para completar seu cadastro.</>
        )}
        {estado.cadastroIncompleto.length > 0 && (
          <>
            {" "}
            (Seu cadastro também está incompleto — falta{" "}
            {estado.cadastroIncompleto.join(", ")} —, mas não é essa a causa
            deste erro.)
          </>
        )}
      </p>
    )
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={estado.fase !== "pronto"}>
          {estado.fase === "carregando" || estado.fase === "abrindo" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Pill className="mr-2 h-4 w-4" />
          )}
          Prescrever
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Prescrever para {paciente.nome}</DialogTitle>
          {/* Não é pergunta de formulário — é o único campo que a Memed exige
              e que o nosso cadastro de paciente não tem. Perguntar aqui é
              melhor que gravar um palpite no cadastro. */}
          <DialogDescription>
            A Memed precisa do sexo do paciente para emitir a receita, e ele não
            consta no cadastro.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <DialogClose asChild>
            <Button variant="outline" className="flex-1" onClick={() => abrir("F")}>
              Feminino
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="outline" className="flex-1" onClick={() => abrir("M")}>
              Masculino
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}
