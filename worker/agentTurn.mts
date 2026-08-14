import Anthropic from "@anthropic-ai/sdk"
import { supabaseServer } from "./supabase.mts"
import type { AgentJob } from "./queue.mts"
import { buildSystemPrompt, loadPromptContext } from "./prompt.mts"
import {
  buildReadTools,
  buildWriteTools,
  buildEscalationTools,
  type ToolContext,
} from "./tools.mts"
import { sendTextToChat } from "./send.mts"

/**
 * Execução de um turno do agente — Plano 3, P3.3.
 *
 * O agente é STATELESS por turno: chega o job, reidrata o histórico do
 * Postgres, chama o modelo com as tools e grava a resposta. Não há sessão
 * hospedada nem workspace — é por isso que Claude API + Tool Runner é a forma
 * certa aqui, e não Managed Agents (container por sessão) nem Agent SDK
 * (agente de codebase).
 *
 * O agente lê (serviços, profissionais, convênios, disponibilidade), ESCREVE
 * na agenda (marcar, remarcar, cancelar — P3.4) e sabe se retirar da conversa
 * (`transferir_para_humano` — P3.5).
 *
 * A escrita não é solta: o gatilho de capacidade da migration 0029 é quem
 * garante, dentro da transação, que dois pacientes não ocupem o mesmo horário.
 * O modelo pode alucinar um horário; o banco não deixa o erro virar duas
 * pessoas na mesma cadeira.
 */

const MODEL = process.env.AGENT_MODEL ?? "claude-opus-5"
const EFFORT = process.env.AGENT_EFFORT ?? "medium"
const MAX_TOKENS = Number(process.env.AGENT_MAX_TOKENS ?? 8000)
const HISTORY_LIMIT = Number(process.env.AGENT_HISTORY_LIMIT ?? 40)

// TTL do cache do system prompt. 1h para clínica de baixo volume: com 5min o
// prefixo expira entre um paciente e outro e a clínica paga 1x sempre.
const CACHE_TTL = process.env.AGENT_CACHE_TTL === "5m" ? "5m" : "1h"

// Flag SEPARADO de AGENT_TURN_ENABLED: permite rodar o agente gerando resposta
// e revisar na inbox antes de liberar o envio ao paciente. Default desligado.
const SEND_ENABLED = process.env.AGENT_SEND_ENABLED === "true"

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) client = new Anthropic()
  return client
}

export interface TurnResult {
  summary: string
}

interface HistoryMessage {
  role: "user" | "assistant"
  content: string
}

export async function processAgentTurn(job: AgentJob): Promise<TurnResult> {
  if (!job.assistant_id) {
    // Canal conectado mas sem agente vinculado. Não é erro: a conversa fica na
    // inbox para atendimento humano.
    return { summary: "sem assistente vinculado — nada a fazer" }
  }

  // (1) Handoff humano tem precedência sobre tudo. Checar aqui, e não só no
  //     enqueue, porque o humano pode ter assumido DEPOIS do job entrar na fila.
  const { data: chat } = await supabaseServer
    .from("myia_chat")
    .select("id, company_id, chat_pause, contact_id")
    .eq("id", job.chat_id)
    .maybeSingle()

  if (!chat || chat.company_id !== job.company_id) {
    throw new Error("chat não encontrado ou de outra empresa")
  }

  if (chat.chat_pause) {
    return { summary: "chat em atendimento humano — agente não responde" }
  }

  // (2) Persona. Assistente pausado também não responde.
  const ctx = await loadPromptContext(job.company_id, job.assistant_id)
  if (!ctx) throw new Error("assistente não encontrado para esta empresa")
  if (ctx.assistant.paused) {
    return { summary: "assistente pausado" }
  }

  const history = await loadHistory(job.chat_id)
  if (history.length === 0) {
    return { summary: "sem mensagens para responder" }
  }

  // (3) Abre o run ANTES de chamar o modelo: se o processo morrer no meio, o
  //     run fica em 'running' e denuncia o turno perdido, em vez de sumir.
  const runId = await openRun(job)
  const startedAt = Date.now()

  const usage = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    iterations: 0,
  }

  try {
    const toolContext: ToolContext = {
      companyId: job.company_id,
      chatId: job.chat_id,
      record: (toolName, input, output, isError, durationMs) =>
        recordToolCall(runId, toolName, input, output, isError, durationMs),
    }

    const runner = getClient().beta.messages.toolRunner({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // Thinking LIGADO. Em Opus 5, desligar tem um modo de falha em que a tool
      // call sai como texto simples: o turno "sucede", a ferramenta nunca roda
      // e ninguém percebe. Num agente que consulta agenda isso é inaceitável —
      // latência se controla por effort, não desligando o thinking.
      thinking: { type: "adaptive" },
      output_config: { effort: EFFORT as "low" | "medium" | "high" },
      system: [
        {
          type: "text",
          text: buildSystemPrompt(ctx),
          // Único breakpoint. Ordem de render é tools -> system -> messages,
          // então isto cacheia as definições de tool junto.
          cache_control: { type: "ephemeral", ttl: CACHE_TTL },
        },
      ],
      // Leitura, escrita e escalonamento numa lista só. A ORDEM IMPORTA para o
      // cache: as definições de tool são renderizadas antes do system prompt e
      // entram no mesmo breakpoint, então basta uma delas mudar de lugar entre
      // turnos para o prefixo inteiro ser reescrito — a clínica pagaria 1x em
      // vez de 0,1x, sem erro nenhum. Por isso a concatenação é fixa aqui, e
      // não montada a partir de flag ou de configuração da clínica.
      tools: [
        ...buildReadTools(toolContext),
        ...buildWriteTools(toolContext),
        ...buildEscalationTools(toolContext),
      ],
      messages: buildMessages(history),
    })

    // Iterar (em vez de só aguardar) é o que dá o custo REAL: cada tool call
    // gera outra ida ao modelo, e o usage da mensagem final cobre apenas a
    // última. Sem somar, o painel de custo do P3.8 subestimaria a conta.
    let finalText = ""

    for await (const message of runner) {
      usage.iterations++
      usage.input += message.usage?.input_tokens ?? 0
      usage.output += message.usage?.output_tokens ?? 0
      usage.cacheRead += message.usage?.cache_read_input_tokens ?? 0
      usage.cacheWrite += message.usage?.cache_creation_input_tokens ?? 0

      const text = message.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim()

      if (text) finalText = text
    }

    if (!finalText) {
      throw new Error("modelo não produziu texto de resposta")
    }

    // (4) Grava a resposta e, se o envio estiver habilitado, manda pelo canal.
    //
    //     AGENT_SEND_ENABLED é um flag SEPARADO de AGENT_TURN_ENABLED de
    //     propósito: dá para rodar o agente gerando resposta e revisar na inbox
    //     antes de deixar qualquer coisa chegar no paciente. Com ele desligado
    //     a mensagem fica PENDING e um humano decide.
    const messageId = await persistAssistantMessage(job, finalText)

    let sent = false
    if (SEND_ENABLED) {
      const result = await sendTextToChat(job.chat_id, job.company_id, finalText)
      sent = result.ok

      await supabaseServer
        .from("myia_messages")
        .update({
          status: result.ok ? "SENT" : "FAILED",
          ...(result.providerMessageId ? { message_id: result.providerMessageId } : {}),
        })
        .eq("id", messageId)

      if (!result.ok) {
        // Não relança: a resposta EXISTE e está na inbox. Refazer o turno
        // gastaria tokens de novo para gerar quase o mesmo texto; o que falhou
        // foi o transporte, e isso um humano resolve reenviando.
        console.error(`[worker] envio falhou no chat ${job.chat_id}: ${result.error}`)
      }
    }

    await closeRun(runId, "ok", null, usage, Date.now() - startedAt)

    return {
      summary: `resposta ${sent ? "enviada" : "gravada"} (${usage.iterations} ida(s) ao modelo, ${usage.output} tokens de saída, ${usage.cacheRead} de cache)`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await closeRun(runId, "error", message, usage, Date.now() - startedAt)
    throw error
  }
}

// ---------------------------------------------------------------------------
// Histórico
// ---------------------------------------------------------------------------

async function loadHistory(chatId: string): Promise<HistoryMessage[]> {
  const { data, error } = await supabaseServer
    .from("myia_messages")
    .select("from_me, message, message_type, message_timestamp, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT)

  if (error) throw new Error(`falha ao ler histórico: ${error.message}`)

  const rows = (data ?? []).slice().reverse()

  const out: HistoryMessage[] = []

  for (const row of rows) {
    const text = extractText(row.message)
    if (!text) continue

    const role = row.from_me ? "assistant" : "user"

    // A API exige alternância; mensagens seguidas do mesmo lado (o paciente
    // mandando 3 linhas) viram um turno só, preservando as quebras.
    const last = out[out.length - 1]
    if (last && last.role === role) {
      last.content += `\n${text}`
    } else {
      out.push({ role, content: text })
    }
  }

  // A conversa tem que começar pelo paciente.
  while (out.length > 0 && out[0].role === "assistant") out.shift()

  return out
}

function extractText(message: unknown): string | null {
  if (!message || typeof message !== "object") return null
  const m = message as Record<string, any>

  return (
    m.conversation ??
    m.text?.body ??
    m.extendedTextMessage?.text ??
    m.interactive?.button_reply?.title ??
    m.button?.text ??
    null
  )
}

function buildMessages(history: HistoryMessage[]): Anthropic.Beta.BetaMessageParam[] {
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((h) => ({
    role: h.role,
    content: h.content,
  }))

  // Data/hora vai aqui, NÃO no system prompt: no system ela mudaria o prefixo a
  // cada requisição e destruiria o cache. Como mensagem `role: "system"` no fim
  // de `messages`, entra depois do prefixo cacheado — e vem pelo canal de
  // operador, então o paciente não consegue forjar ("hoje é 25 de dezembro").
  const now = new Date()
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "full",
    timeStyle: "short",
  }).format(now)

  messages.push({
    role: "system",
    content: `Agora é ${formatted} (horário de Brasília). A data de hoje no formato AAAA-MM-DD é ${
      new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now)
    }. Use isso ao interpretar "hoje", "amanhã" e "semana que vem".`,
  })

  return messages
}

// ---------------------------------------------------------------------------
// Persistência
// ---------------------------------------------------------------------------

async function persistAssistantMessage(job: AgentJob, text: string): Promise<string> {
  const { data, error } = await supabaseServer.from("myia_messages").insert([
    {
      chat_id: job.chat_id,
      from_me: true,
      message: { conversation: text },
      message_type: "conversation",
      message_timestamp: Math.floor(Date.now() / 1000),
      // Nasce PENDING mesmo quando o envio está ligado: o status vira SENT ou
      // FAILED depois da resposta do provedor. Assim uma queda entre gravar e
      // enviar deixa a mensagem visível como pendente, não como enviada.
      status: "PENDING",
    },
  ])
  .select("id")
  .single()

  if (error) throw new Error(`falha ao gravar resposta: ${error.message}`)

  await supabaseServer
    .from("myia_chat")
    .update({
      last_message: { text, from_me: true },
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.chat_id)

  return data.id
}

// ---------------------------------------------------------------------------
// Observabilidade
// ---------------------------------------------------------------------------

async function openRun(job: AgentJob): Promise<string> {
  const { data, error } = await supabaseServer
    .from("myia_agent_runs")
    .insert([
      {
        company_id: job.company_id,
        assistant_id: job.assistant_id,
        chat_id: job.chat_id,
        job_id: job.id,
        model: MODEL,
        effort: EFFORT,
        status: "running",
      },
    ])
    .select("id")
    .single()

  if (error) throw new Error(`falha ao abrir run: ${error.message}`)

  return data.id
}

async function closeRun(
  runId: string,
  status: "ok" | "error",
  errorMessage: string | null,
  usage: {
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
    iterations: number
  },
  latencyMs: number,
): Promise<void> {
  const { error } = await supabaseServer
    .from("myia_agent_runs")
    .update({
      status,
      error: errorMessage,
      input_tokens: usage.input,
      output_tokens: usage.output,
      cache_read_tokens: usage.cacheRead,
      cache_write_tokens: usage.cacheWrite,
      iterations: usage.iterations,
      latency_ms: latencyMs,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId)

  // Não propaga: perder o registro não pode derrubar um turno que já respondeu.
  if (error) {
    console.error(`[worker] falha ao fechar run ${runId}:`, error.message)
  }
}

async function recordToolCall(
  runId: string,
  toolName: string,
  input: unknown,
  output: unknown,
  isError: boolean,
  durationMs: number,
): Promise<void> {
  const { error } = await supabaseServer.from("myia_agent_tool_calls").insert([
    {
      run_id: runId,
      tool_name: toolName,
      input: input ?? null,
      output: output ?? null,
      is_error: isError,
      duration_ms: durationMs,
    },
  ])

  if (error) {
    console.error(`[worker] falha ao registrar tool ${toolName}:`, error.message)
  }
}
