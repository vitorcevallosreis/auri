#!/usr/bin/env node --experimental-strip-types
/**
 * Teste de integração do worker — Plano 3, P3.2.
 *
 * Uso: node --experimental-strip-types scripts/test-worker-integration.mts
 *
 * Os testes SQL (supabase/tests/0014_agent_jobs.test.sql) provam a semântica da
 * fila. Este aqui prova o que eles não alcançam: o worker de verdade, como
 * processo, reivindicando e finalizando job contra o banco real.
 *
 * Escreve linhas no banco e as remove no fim, inclusive em caso de falha.
 */

import { readFileSync, existsSync } from "node:fs"
import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"

// Carrega .env.local (mesmo padrão do scripts/db-test.mjs).
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}

const { supabaseServer } = await import("../src/lib/supabase/server.ts")

const COMPANY_ID = randomUUID()
const CHAT_ID = randomUUID()

let failures = 0

function check(ok: boolean, label: string) {
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}`)
  if (!ok) failures++
}

async function cleanup() {
  await supabaseServer.from("myia_agent_jobs").delete().eq("company_id", COMPANY_ID)
  await supabaseServer.from("myia_chat").delete().eq("id", CHAT_ID)
  await supabaseServer.from("myia_companies").delete().eq("id", COMPANY_ID)
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

try {
  // -------------------------------------------------------------------------
  console.log("\n# fixtures")
  await supabaseServer
    .from("myia_companies")
    .insert([{ id: COMPANY_ID, name: "Worker Integration Test" }])
  await supabaseServer
    .from("myia_chat")
    .insert([{ id: CHAT_ID, company_id: COMPANY_ID, instance_id: "worker-it" }])
  console.log("  criadas")

  // -------------------------------------------------------------------------
  console.log("\n# debounce: 3 enqueues no mesmo chat = 1 job")
  for (let i = 0; i < 3; i++) {
    await supabaseServer.rpc("myia_enqueue_agent_turn", {
      p_company_id: COMPANY_ID,
      p_chat_id: CHAT_ID,
      p_assistant_id: null,
      p_debounce_seconds: 0,
    })
  }

  const { data: afterEnqueue } = await supabaseServer
    .from("myia_agent_jobs")
    .select("id, status, attempts")
    .eq("company_id", COMPANY_ID)

  check(afterEnqueue?.length === 1, `1 job criado (veio ${afterEnqueue?.length})`)
  check(afterEnqueue?.[0]?.status === "pending", "job começa pending")

  // -------------------------------------------------------------------------
  console.log("\n# worker: claim + finish (job sem assistente = sucesso)")
  // Sem assistant_id o stub retorna sucesso em vez de lançar — é o caminho
  // "canal conectado, nenhum agente vinculado".
  const worker = spawn(
    process.execPath,
    ["--experimental-strip-types", "worker/index.mts"],
    {
      env: {
        ...process.env,
        AGENT_TURN_ENABLED: "true",
        WORKER_POLL_INTERVAL_MS: "300",
        WORKER_REAP_INTERVAL_MS: "999999",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  )

  let workerLog = ""
  worker.stdout.on("data", (d) => (workerLog += d.toString()))
  worker.stderr.on("data", (d) => (workerLog += d.toString()))

  await sleep(4000)

  const { data: afterRun } = await supabaseServer
    .from("myia_agent_jobs")
    .select("id, status, attempts, locked_by")
    .eq("company_id", COMPANY_ID)

  const job = afterRun?.[0]

  check(job?.status === "done", `job concluído (status=${job?.status})`)
  check(job?.attempts === 1, `1 tentativa (veio ${job?.attempts})`)
  check(
    typeof job?.locked_by !== "string" || job.locked_by === null,
    "locked_by liberado no finish",
  )
  check(workerLog.includes("iniciando"), "worker logou o boot")
  check(
    workerLog.includes("sem assistente vinculado"),
    "worker executou o turno stub",
  )

  // -------------------------------------------------------------------------
  console.log("\n# shutdown gracioso (SIGTERM)")
  worker.kill("SIGTERM")

  const exited = await Promise.race([
    new Promise<boolean>((r) => worker.on("exit", () => r(true))),
    sleep(8000).then(() => false),
  ])

  check(exited, "worker saiu ao receber SIGTERM")
  check(workerLog.includes("encerrado"), "worker logou encerramento limpo")

  if (!exited) worker.kill("SIGKILL")

  // -------------------------------------------------------------------------
  console.log("\n# falha do turno: volta para a fila com backoff")
  // Com assistant_id inexistente o insert falharia por FK, então o caminho de
  // erro é forçado marcando o job para reprocessar e derrubando o turno pelo
  // stub — que lança quando HÁ assistant_id.
  await supabaseServer.rpc("myia_finish_agent_job", {
    p_job_id: job!.id,
    p_ok: false,
    p_error: "erro simulado",
  })

  const { data: afterFail } = await supabaseServer
    .from("myia_agent_jobs")
    .select("status, run_after, last_error, attempts")
    .eq("id", job!.id)
    .single()

  check(afterFail?.status === "pending", `voltou para pending (${afterFail?.status})`)
  check(
    new Date(afterFail!.run_after).getTime() > Date.now(),
    "run_after adiado pelo backoff",
  )
  check(afterFail?.last_error === "erro simulado", "erro registrado")
} finally {
  console.log("\n# limpeza")
  await cleanup()
  console.log("  removidas")
}

console.log(
  failures === 0 ? "\nPASS" : `\nFAIL — ${failures} asserção(ões)`,
)
process.exit(failures === 0 ? 0 : 1)
