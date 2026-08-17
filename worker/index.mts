#!/usr/bin/env node --experimental-strip-types
import { hostname } from "node:os"
import { randomUUID } from "node:crypto"
import { claimJobs, finishJob, reapStaleJobs, type AgentJob } from "./queue.mts"
import { processAgentTurn } from "./agentTurn.mts"
import {
  claimSessoes,
  processarEscuta,
  reapSessoes,
  varrerAudioOrfao,
} from "./escuta.mts"

/**
 * auri-agent-worker — Plano 3, P3.2.
 *
 * Consome a fila de turnos do agente (migration 0014). Roda como container
 * separado do Next.js por três motivos:
 *
 *  1. A Meta reentrega o webhook se não receber 200 em ~5s; um turno do agente
 *     leva segundos. Processar dentro da requisição garantiria reentrega.
 *  2. Deploy do painel não pode derrubar conversa em andamento.
 *  3. Concorrência precisa ser limitada e observável, o que não dá para fazer
 *     dentro de um handler serverless-like.
 *
 * Sem framework: `node --experimental-strip-types` roda TypeScript direto, sem
 * build. Por isso este diretório evita recursos de TS que exijam transformação
 * (enum, parameter property, decorator) — só anotação de tipo.
 */

const WORKER_ID = `${hostname()}-${randomUUID().slice(0, 8)}`

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 1000)
const CLAIM_BATCH = Number(process.env.WORKER_CLAIM_BATCH ?? 10)
const REAP_TIMEOUT_S = Number(process.env.WORKER_REAP_TIMEOUT_SECONDS ?? 300)
const REAP_EVERY_MS = Number(process.env.WORKER_REAP_INTERVAL_MS ?? 60_000)

// Default FALSE de propósito: enquanto o turno do agente é stub (P3.3), um
// worker ligado consumiria jobs sem responder ao paciente. Ligar só quando o
// turno existir de verdade.
const TURN_ENABLED = process.env.AGENT_TURN_ENABLED === "true"

// Escuta (0027). Ligada por padrão, ao contrário do turno do agente: aqui não
// há risco de consumir fila sem responder — sem transcritor configurado o
// médico nem consegue gravar, porque a tela consulta o portão antes.
const ESCUTA_ENABLED = process.env.ESCUTA_WORKER_ENABLED !== "false"
const ESCUTA_BATCH = Number(process.env.ESCUTA_CLAIM_BATCH ?? 1)
// 30 min: transcrever 15 minutos de consulta leva ~30 neste VPS. Teto curto
// reviveria sessão que está apenas demorando, e duas transcrições da mesma
// consulta é pior que uma lenta.
const ESCUTA_REAP_TIMEOUT_S = Number(process.env.ESCUTA_REAP_TIMEOUT_SECONDS ?? 1800)

let running = true
let inFlight = 0
let lastReapAt = 0
let escutaEmCurso = 0
let lastEscutaReapAt = 0

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

async function tick(): Promise<void> {
  const now = Date.now()

  if (now - lastReapAt >= REAP_EVERY_MS) {
    lastReapAt = now
    const revived = await reapStaleJobs(REAP_TIMEOUT_S)
    if (revived > 0) {
      console.warn(`[worker] reaper devolveu ${revived} job(s) à fila`)
    }
  }

  const jobs = await claimJobs(WORKER_ID, CLAIM_BATCH)
  if (jobs.length === 0) return

  // Justiça entre clínicas: jobs do MESMO tenant rodam em sequência, tenants
  // diferentes em paralelo. Sem isso, uma clínica movimentada tomaria todos os
  // slots do worker e as outras esperariam atrás dela.
  //
  // Escolhi agrupar em vez de um semáforo por tenant porque não exige estado
  // novo nem devolver job à fila — a garantia sai da própria estrutura do lote.
  const byCompany = new Map<string, AgentJob[]>()
  for (const job of jobs) {
    const list = byCompany.get(job.company_id) ?? []
    list.push(job)
    byCompany.set(job.company_id, list)
  }

  inFlight += jobs.length

  await Promise.all(
    [...byCompany.values()].map(async (companyJobs) => {
      for (const job of companyJobs) {
        await runJob(job)
      }
    }),
  )

  inFlight -= jobs.length
}

/**
 * Escuta do prontuário (0027) — fila própria, no mesmo processo.
 *
 * Fila separada da do agente de propósito: os dois trabalhos têm nada a ver um
 * com o outro e perfis opostos. Um turno do agente leva segundos e é
 * conversacional; uma transcrição leva DEZENAS DE MINUTOS e é CPU pura. Num
 * lote comum, uma consulta longa seguraria as respostas de WhatsApp atrás dela.
 *
 * Por isso `ESCUTA_CLAIM_BATCH` é 1 por padrão: duas transcrições ao mesmo
 * tempo neste VPS (4 vCPU, sem GPU) só fazem as duas demorarem o dobro, e o
 * Whisper é um container só.
 */
async function tickEscuta(): Promise<void> {
  const now = Date.now()

  if (now - lastEscutaReapAt >= REAP_EVERY_MS) {
    lastEscutaReapAt = now
    try {
      const devolvidas = await reapSessoes(ESCUTA_REAP_TIMEOUT_S)
      if (devolvidas > 0) {
        console.warn(`[escuta] reaper devolveu ${devolvidas} sessão(ões) à fila`)
      }
      const orfaos = await varrerAudioOrfao()
      if (orfaos > 0) {
        console.warn(`[escuta] varredura apagou ${orfaos} áudio(s) órfão(s)`)
      }
    } catch (err) {
      console.error("[escuta] manutenção falhou:", err)
    }
  }

  if (escutaEmCurso > 0) return

  let sessoes: Awaited<ReturnType<typeof claimSessoes>>
  try {
    sessoes = await claimSessoes(WORKER_ID, ESCUTA_BATCH)
  } catch (err) {
    console.error("[escuta] claim falhou:", err)
    return
  }
  if (sessoes.length === 0) return

  escutaEmCurso += sessoes.length
  try {
    for (const s of sessoes) {
      const t0 = Date.now()
      await processarEscuta(s)
      console.log(`[escuta] sessão ${s.id} em ${Math.round((Date.now() - t0) / 1000)}s`)
    }
  } finally {
    escutaEmCurso -= sessoes.length
  }
}

async function runJob(job: AgentJob): Promise<void> {
  const startedAt = Date.now()

  try {
    const result = await processAgentTurn(job)
    await finishJob(job.id, true)

    console.log(
      `[worker] job ${job.id} ok em ${Date.now() - startedAt}ms — ${result.summary}`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    // A decisão de retry/backoff/superseded é do banco, não daqui.
    await finishJob(job.id, false, message)

    console.error(
      `[worker] job ${job.id} falhou (tentativa ${job.attempts}/${job.max_attempts}): ${message}`,
    )
  }
}

// ---------------------------------------------------------------------------
// Ciclo de vida
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`[worker] iniciando ${WORKER_ID}`)
  console.log(
    `[worker] poll=${POLL_INTERVAL_MS}ms batch=${CLAIM_BATCH} reap=${REAP_TIMEOUT_S}s turno=${TURN_ENABLED ? "ATIVO" : "DESATIVADO"}`,
  )
  console.log(
    `[escuta] ${ESCUTA_ENABLED ? "ATIVA" : "DESATIVADA"} batch=${ESCUTA_BATCH} reap=${ESCUTA_REAP_TIMEOUT_S}s`,
  )

  if (!TURN_ENABLED) {
    // Loga alto: um worker rodando com o turno desativado consome fila sem
    // responder. É o default seguro até o P3.3, mas não pode ser silencioso.
    console.warn(
      "[worker] AGENT_TURN_ENABLED != true — nenhum job será processado. " +
        "As mensagens seguem chegando na inbox para atendimento humano.",
    )
  }

  while (running) {
    try {
      if (TURN_ENABLED) {
        await tick()
      } else {
        // Ainda roda o reaper: jobs presos de uma execução anterior precisam
        // voltar à fila mesmo com o turno desligado.
        await reapStaleJobs(REAP_TIMEOUT_S)
      }

      // Fila separada e independente: um turno do agente com defeito não pode
      // impedir a transcrição de uma consulta, nem o contrário. Por isso o
      // `try` de cada uma é próprio, e não um só em volta das duas.
      if (ESCUTA_ENABLED) {
        try {
          await tickEscuta()
        } catch (error) {
          console.error("[escuta] erro no ciclo:", error)
        }
      }
    } catch (error) {
      // Erro no loop (rede, banco fora) não pode matar o worker — o container
      // reiniciaria em ciclo. Loga e tenta de novo no próximo tick.
      console.error("[worker] erro no ciclo:", error)
    }

    await sleep(POLL_INTERVAL_MS)
  }

  // Shutdown gracioso: o container recebe SIGTERM no deploy. Terminar os jobs
  // em voo evita deixá-los em 'running' esperando o reaper (5 min de silêncio
  // para aquele paciente).
  console.log(`[worker] encerrando — aguardando ${inFlight} job(s) em voo`)

  const deadline = Date.now() + 30_000
  while (inFlight > 0 && Date.now() < deadline) {
    await sleep(200)
  }

  if (inFlight > 0) {
    console.warn(
      `[worker] ${inFlight} job(s) ainda em voo no timeout — o reaper resolve`,
    )
  }

  console.log("[worker] encerrado")
  process.exit(0)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    if (!running) return
    console.log(`[worker] ${signal} recebido`)
    running = false
  })
}

main().catch((error) => {
  console.error("[worker] falha fatal:", error)
  process.exit(1)
})
