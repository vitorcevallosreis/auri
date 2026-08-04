import { readFile, unlink } from "node:fs/promises"
import { supabase } from "./supabase.mts"

/**
 * Escuta do prontuário — o lado longo, fora da requisição HTTP.
 *
 * Medido no VPS de produção com Whisper `medium`: ~2x tempo real. Uma consulta
 * de 15 minutos leva ~30 para transcrever. Isso não cabe numa requisição, e
 * aumentar timeout não resolve — queda de rede, deploy ou a aba fechando
 * perderiam a consulta, que é a única coisa aqui que não se repete.
 *
 * A fila é a própria `myia_listening_sessions` (0027): uma linha por trabalho,
 * reivindicada com `skip locked`. Não há tabela de jobs ao lado porque ela
 * duplicaria a fonte da verdade.
 *
 * ⚠️ Este módulo é o ÚNICO lugar que apaga o áudio do disco. Se um caminho de
 * saída novo for acrescentado abaixo, ele tem que passar por `descartar()` —
 * ver o cabeçalho de 0027 sobre por que o arquivo existe e por quanto tempo.
 *
 * Roda sob `--experimental-strip-types`: só anotação de tipo, sem recurso que
 * exija transformação.
 */

const IDIOMA = process.env.ESCUTA_IDIOMA ?? "pt"

export interface SessaoEscuta {
  id: string
  audio_path: string | null
  template_id: string | null
  appointment_id: string | null
  attempts: number
}

// ---------------------------------------------------------------------------
// Fila
// ---------------------------------------------------------------------------

export async function claimSessoes(workerId: string, limite: number): Promise<SessaoEscuta[]> {
  const { data, error } = await supabase.rpc("claim_listening_sessions", {
    p_worker: workerId,
    p_limit: limite,
  })
  if (error) throw error
  return (data ?? []) as SessaoEscuta[]
}

export async function reapSessoes(timeoutSegundos: number): Promise<number> {
  const { data, error } = await supabase.rpc("reap_listening_sessions", {
    p_timeout_seconds: timeoutSegundos,
    p_max_attempts: 3,
  })
  if (error) throw error
  return Number(data ?? 0)
}

/**
 * Apaga áudio que ficou para trás — worker morto entre transcrever e limpar.
 *
 * O banco devolve os caminhos e já zera a coluna; aqui só resta o disco. Um
 * arquivo que não existe mais não é erro: o objetivo era exatamente esse.
 */
export async function varrerAudioOrfao(): Promise<number> {
  const { data, error } = await supabase.rpc("sweep_listening_audio", {
    p_older_than_hours: 6,
  })
  if (error) throw error
  const caminhos = (data ?? []) as string[]
  for (const c of caminhos) await descartar(c)
  return caminhos.length
}

async function descartar(caminho: string | null): Promise<void> {
  if (!caminho) return
  try {
    await unlink(caminho)
  } catch {
    /* já não estava lá */
  }
}

// ---------------------------------------------------------------------------
// Processamento
// ---------------------------------------------------------------------------

async function marcar(
  id: string,
  status: string,
  transcript?: string | null,
  falha?: string | null
): Promise<void> {
  const { error } = await supabase.rpc("worker_update_listening_session", {
    p_session_id: id,
    p_status: status,
    p_transcript: transcript ?? null,
    p_failure_reason: falha ?? null,
  })
  if (error) console.error(`[escuta] não consegui marcar ${status} em ${id}:`, error.message)
}

/**
 * Transcreve e redige uma sessão.
 *
 * ORDEM QUE IMPORTA: a transcrição é gravada no banco ANTES de o modelo
 * redigir. Se a redação falhar, o médico ainda tem o texto da consulta — que é
 * o que não dá para refazer. O rascunho, sim, dá.
 */
export async function processarEscuta(s: SessaoEscuta): Promise<void> {
  if (!s.audio_path) {
    await marcar(s.id, "failed", null, "A gravação não chegou ao servidor.")
    return
  }

  // Os adaptadores são do app (TypeScript com alias `@/`), que este worker não
  // resolve. Importados por caminho relativo — é o preço de rodar sem build.
  const { getTranscritor, TranscricaoIndisponivel } = await import(
    "../src/lib/escuta/transcricao.ts"
  )
  const { redigirRascunho, RedacaoIndisponivel } = await import("../src/lib/escuta/redacao.ts")

  let transcricao: string
  try {
    const bytes = await readFile(s.audio_path)
    const blob = new Blob([bytes], { type: "audio/webm" })
    const r = await getTranscritor().transcrever(blob, { idioma: IDIOMA })
    transcricao = r.texto
  } catch (err: any) {
    const msg =
      err instanceof TranscricaoIndisponivel ? err.message : "A transcrição falhou."
    console.error(`[escuta] transcrição de ${s.id}:`, msg)
    await marcar(s.id, "failed", null, msg)
    await descartar(s.audio_path)
    return
  }

  // O áudio já cumpriu seu papel. Sai do disco aqui, antes da redação, para
  // não depender de o que vem a seguir dar certo.
  await descartar(s.audio_path)
  await marcar(s.id, "drafting", transcricao, null)

  // Contexto do rascunho: nome do paciente e serviço. Lido com a chave de
  // serviço porque o worker não tem sessão de médico — o escopo vem da própria
  // sessão, que só existe porque um médico autenticado a criou.
  const { data: ctx } = await supabase
    .from("myia_listening_sessions")
    .select(
      "myia_record_templates(fields), myia_appointments(cliente_nome, myia_services(name))"
    )
    .eq("id", s.id)
    .maybeSingle()

  const tpl: any = Array.isArray((ctx as any)?.myia_record_templates)
    ? (ctx as any).myia_record_templates[0]
    : (ctx as any)?.myia_record_templates
  const campos = Array.isArray(tpl?.fields) ? tpl.fields : []

  if (!campos.length) {
    await marcar(s.id, "failed", null, "O modelo de prontuário não tem campos.")
    return
  }

  const appt: any = Array.isArray((ctx as any)?.myia_appointments)
    ? (ctx as any).myia_appointments[0]
    : (ctx as any)?.myia_appointments
  const svc = appt && (Array.isArray(appt.myia_services) ? appt.myia_services[0] : appt.myia_services)

  try {
    const { content, modelo } = await redigirRascunho(transcricao, campos, {
      paciente: appt?.cliente_nome ?? null,
      servico: svc?.name ?? null,
    })

    const { error } = await supabase.rpc("worker_finish_listening_session", {
      p_session_id: s.id,
      p_content: content,
      p_ai_model: modelo,
    })
    if (error) throw error

    console.log(`[escuta] ${s.id} concluída`)
  } catch (err: any) {
    const msg =
      err instanceof RedacaoIndisponivel
        ? err.message
        : err?.code === "23505"
          ? "Este atendimento já tem prontuário."
          : "A redação do rascunho falhou."
    console.error(`[escuta] redação de ${s.id}:`, msg)
    // `failed` e não `queued`: a transcrição está salva, e retentar a redação
    // sem que ninguém tenha mudado nada só gastaria o mesmo erro três vezes.
    // A recuperação a partir da transcrição é trabalho de tela, não de laço.
    await marcar(s.id, "failed", null, msg)
  }
}
