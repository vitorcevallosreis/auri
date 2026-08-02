"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/config"
import { authedFetch } from "@/lib/api/authedFetch"
import { useRecordTemplates } from "@/hooks/useMedicalRecords"
import { useAtendimentosSemProntuario } from "@/hooks/useMedicalRecordWrite"
import { useProfessionalIdentity } from "@/hooks/useProfessionalIdentity"

export type Etapa =
  | "escolha"      // atendimento + modelo + consentimento
  | "gravando"
  | "pausado"
  | "processando"  // transcrevendo + redigindo
  | "erro"

export function useEscutaModel() {
  const router = useRouter()
  const { atendimentos, loading: loadingAppts } = useAtendimentosSemProntuario()
  const { templates } = useRecordTemplates()
  const { identity } = useProfessionalIdentity()

  const [disponivel, setDisponivel] = useState<boolean | null>(null)
  const [etapa, setEtapa] = useState<Etapa>("escolha")
  const [erro, setErro] = useState<string | null>(null)
  const [segundos, setSegundos] = useState(0)
  const [nivel, setNivel] = useState(0)

  const [atendimentoId, setAtendimentoId] = useState<string | null>(null)
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [consentimento, setConsentimento] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)

  // A escuta depende de duas chaves no servidor. Perguntar ANTES é o que evita
  // o médico conduzir a consulta inteira gravando para descobrir no fim que
  // não havia transcrição configurada.
  useEffect(() => {
    authedFetch("/api/prontuario/escuta")
      .then((r) => r.json())
      .then((j) => setDisponivel(Boolean(j?.disponivel)))
      .catch(() => setDisponivel(false))
  }, [])

  // Modelos da especialidade primeiro, mesma regra da criação manual.
  const ordenados = identity.especialidade
    ? [...templates].sort(
        (a, b) =>
          (a.specialty === identity.especialidade ? 0 : 1) -
          (b.specialty === identity.especialidade ? 0 : 1)
      )
    : templates
  const templateEfetivo = templateId ?? ordenados[0]?.id ?? null

  /** Solta microfone, medidor e cronômetro. Idempotente de propósito: é
   *  chamado no fim normal, no erro e no desmonte. */
  const liberarRecursos = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  // O microfone precisa desligar se a pessoa navegar para fora no meio da
  // gravação. Sem isto o indicador do navegador fica aceso e o áudio continua
  // sendo capturado numa tela que não existe mais.
  useEffect(() => liberarRecursos, [liberarRecursos])

  useEffect(() => {
    if (etapa !== "gravando") return
    const id = setInterval(() => setSegundos((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [etapa])

  /** Medidor de nível: é o que prova ao médico que o microfone está captando.
   *  Um cronômetro correndo sobre um microfone mudo é a pior falha possível
   *  aqui — só se descobre no fim. */
  function medirNivel(stream: MediaStream) {
    const ctx = new AudioContext()
    audioCtxRef.current = ctx
    const analiser = ctx.createAnalyser()
    analiser.fftSize = 256
    ctx.createMediaStreamSource(stream).connect(analiser)
    const dados = new Uint8Array(analiser.frequencyBinCount)

    const tick = () => {
      analiser.getByteFrequencyData(dados)
      const media = dados.reduce((a, b) => a + b, 0) / dados.length
      setNivel(Math.min(1, media / 90))
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()
  }

  async function iniciar() {
    setErro(null)
    if (!atendimentoId || !templateEfetivo) {
      setErro("Escolha o atendimento e o modelo.")
      return
    }
    if (!consentimento) {
      setErro("Registre o consentimento do paciente antes de iniciar.")
      return
    }

    try {
      // A sessão (com o consentimento) é criada ANTES de o microfone ligar.
      // Ordem invertida deixaria áudio existindo sem registro de aceite.
      const { data, error } = await supabase
        .rpc("start_listening_session", {
          p_appointment_id: atendimentoId,
          p_template_id: templateEfetivo,
          p_consent_method: "verbal",
        })
        .single()
      if (error) throw error
      setSessionId((data as any).id)

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      streamRef.current = stream
      medirNivel(stream)

      chunksRef.current = []
      const rec = new MediaRecorder(stream)
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.start(1000)
      recorderRef.current = rec

      setSegundos(0)
      setEtapa("gravando")
    } catch (err: any) {
      console.error("[escuta] início:", err)
      setErro(
        err?.name === "NotAllowedError"
          ? "O navegador bloqueou o microfone. Libere o acesso e tente de novo."
          : err?.message || "Não foi possível iniciar a escuta."
      )
      liberarRecursos()
    }
  }

  function pausar() {
    recorderRef.current?.pause()
    setEtapa("pausado")
  }

  function retomar() {
    recorderRef.current?.resume()
    setEtapa("gravando")
  }

  async function encerrar() {
    const rec = recorderRef.current
    if (!rec || !sessionId) return

    setEtapa("processando")

    const audio = await new Promise<Blob>((resolve) => {
      rec.onstop = () => resolve(new Blob(chunksRef.current, { type: rec.mimeType }))
      rec.stop()
    })
    liberarRecursos()

    try {
      const form = new FormData()
      form.append("sessionId", sessionId)
      form.append("audio", audio, "consulta.webm")

      const resp = await authedFetch("/api/prontuario/escuta", {
        method: "POST",
        body: form,
      })
      const json = await resp.json()

      if (!resp.ok) throw new Error(json?.erro || "A escuta falhou.")

      // Vai direto para o rascunho em modo de leitura: o médico precisa LER o
      // que a IA escreveu antes de editar, não cair num formulário já aberto
      // que convida a assinar sem conferir.
      router.push(`/pro/prontuario/${json.recordId}`)
    } catch (err: any) {
      console.error("[escuta] envio:", err)
      setErro(err?.message || "A escuta falhou.")
      setEtapa("erro")
    } finally {
      // O áudio sai da memória aqui. Não há cópia em disco em lugar nenhum.
      chunksRef.current = []
    }
  }

  function cancelar() {
    recorderRef.current?.stop()
    liberarRecursos()
    chunksRef.current = []
    if (sessionId) {
      supabase
        .rpc("update_listening_session", { p_session_id: sessionId, p_status: "cancelled" })
        .then(undefined, () => {})
    }
    setSessionId(null)
    setSegundos(0)
    setEtapa("escolha")
  }

  return {
    disponivel,
    etapa,
    erro,
    segundos,
    nivel,
    atendimentos,
    loadingAtendimentos: loadingAppts,
    templates: ordenados,
    especialidade: identity.especialidade,
    atendimentoId, setAtendimentoId,
    templateId: templateEfetivo, setTemplateId,
    consentimento, setConsentimento,
    iniciar, pausar, retomar, encerrar, cancelar,
    voltarParaEscolha: () => setEtapa("escolha"),
  }
}

export type IEscutaModel = ReturnType<typeof useEscutaModel>
