#!/usr/bin/env node
// Smoke-test de go-live do gateway de WhatsApp (Evolution API) — Plano 2.
//
// Rode DEPOIS que o VPS do Evolution estiver de pé (docs/deploy/evolution-vps.md)
// e as envs configuradas. Ele NÃO precisa do app Next rodando — fala direto com
// o Evolution API, imitando exatamente o bloco `webhook` que
// src/app/api/whatsapp/instance/route.ts (handleCreate) envia no /instance/create.
//
// Uso:
//   node scripts/whatsapp-golive-check.mjs
//
// Config (lida de env; se ausente, tenta .env.local e depois .env.supabase-dev):
//   EVOLUTION_API_URL        base URL do Evolution (ex: https://evo.SEUDOMINIO.com.br)
//   EVOLUTION_API_KEY        AUTHENTICATION_API_KEY global (header `apikey`)
//   EVOLUTION_WEBHOOK_SECRET segredo do header X-Auri-Webhook-Secret (= o do ingress)
//   NEXT_PUBLIC_APP_URL      URL pública do app (ex: https://app.SEUDOMINIO.com.br)
// Variáveis de ambiente têm precedência sobre os arquivos .env*.
//
// Objetivo nº1: validar o CAVEAT do webhook — confirmar via /webhook/find que o
// /instance/create REALMENTE persistiu nosso webhook (url + header + eventos). Se
// não persistiu, o script falha com a instrução de usar POST /webhook/set.
//
// Exit code: 0 se todos os passos obrigatórios passaram; 1 caso contrário. O
// cleanup (delete da instância descartável) roda sempre (try/finally).

import { readFileSync, existsSync } from "node:fs"

// ---------------------------------------------------------------------------
// Carregamento de env (imita scripts/db-test.mjs): arquivos não sobrescrevem o
// que já veio do ambiente.
// ---------------------------------------------------------------------------
function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}
loadEnvFile(".env.local")
loadEnvFile(".env.supabase-dev")

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY
const EVOLUTION_WEBHOOK_SECRET = process.env.EVOLUTION_WEBHOOK_SECRET
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL

const EXPECTED_VERSION = "2.3.7"
const WEBHOOK_EVENTS = ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED", "SEND_MESSAGE"]
const FETCH_TIMEOUT_MS = 15000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mask(secret) {
  if (!secret) return "(vazio)"
  const s = String(secret)
  if (s.length <= 6) return "***"
  return s.slice(0, 3) + "***" + s.slice(-2)
}

const results = []
function record(name, ok, detail) {
  results.push({ name, ok, detail })
  const tag = ok ? "PASS" : "FAIL"
  console.log(`[${tag}] ${name}${detail ? " — " + detail : ""}`)
}

function trimSlash(url) {
  return String(url).replace(/\/$/, "")
}

// fetch com timeout + apikey; devolve { ok, status, json, text, error }
async function evo(path, { method = "GET", body } = {}) {
  const url = `${trimSlash(EVOLUTION_API_URL)}${path}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const resp = await fetch(url, {
      method,
      headers: {
        apikey: EVOLUTION_API_KEY,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    const text = await resp.text().catch(() => "")
    let json = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }
    return { ok: resp.ok, status: resp.status, json, text }
  } catch (err) {
    const isAbort = err && err.name === "AbortError"
    return { ok: false, status: 0, json: null, text: "", error: isAbort ? `timeout após ${FETCH_TIMEOUT_MS}ms` : String(err) }
  } finally {
    clearTimeout(timer)
  }
}

function webhookBlock(webhookUrl) {
  // MESMO shape usado por src/app/api/whatsapp/instance/route.ts (handleCreate).
  return {
    url: webhookUrl,
    byEvents: false,
    base64: false,
    headers: { "X-Auri-Webhook-Secret": EVOLUTION_WEBHOOK_SECRET },
    events: WEBHOOK_EVENTS,
  }
}

// ---------------------------------------------------------------------------
// Pré-checagem de config
// ---------------------------------------------------------------------------
function checkConfig() {
  const missing = []
  if (!EVOLUTION_API_URL) missing.push("EVOLUTION_API_URL")
  if (!EVOLUTION_API_KEY) missing.push("EVOLUTION_API_KEY")
  if (!EVOLUTION_WEBHOOK_SECRET) missing.push("EVOLUTION_WEBHOOK_SECRET")
  if (!NEXT_PUBLIC_APP_URL) missing.push("NEXT_PUBLIC_APP_URL")
  console.log("== Config ==")
  console.log(`  EVOLUTION_API_URL        = ${EVOLUTION_API_URL || "(ausente)"}`)
  console.log(`  EVOLUTION_API_KEY        = ${mask(EVOLUTION_API_KEY)}`)
  console.log(`  EVOLUTION_WEBHOOK_SECRET = ${mask(EVOLUTION_WEBHOOK_SECRET)}`)
  console.log(`  NEXT_PUBLIC_APP_URL      = ${NEXT_PUBLIC_APP_URL || "(ausente)"}`)
  console.log("")
  if (missing.length) {
    console.error(`ERRO: faltam envs obrigatórias: ${missing.join(", ")}`)
    console.error("Defina-as no ambiente ou em .env.local antes de rodar o smoke-test.")
    return false
  }
  return true
}

// ---------------------------------------------------------------------------
// Passos
// ---------------------------------------------------------------------------
async function stepHealth() {
  const r = await evo("/")
  if (!r.ok) {
    record("1. Health GET /", false, r.error || `status ${r.status} ${r.text?.slice(0, 200)}`)
    return
  }
  const version = r.json?.version ?? r.json?.data?.version ?? null
  if (!version) {
    record("1. Health GET /", true, `200, mas sem campo version no corpo: ${JSON.stringify(r.json)?.slice(0, 200)}`)
    return
  }
  if (version !== EXPECTED_VERSION) {
    record("1. Health GET /", true, `versão ${version} (esperado ${EXPECTED_VERSION} — AVISO: versão diferente)`)
  } else {
    record("1. Health GET /", true, `Evolution v${version}`)
  }
}

async function stepCreate(instanceName, webhookUrl) {
  const payload = {
    instanceName,
    integration: "WHATSAPP-BAILEYS",
    qrcode: true,
    webhook: webhookBlock(webhookUrl),
  }
  const r = await evo("/instance/create", { method: "POST", body: payload })
  if (!r.ok) {
    record("2. Create instância descartável", false, r.error || `status ${r.status}: ${JSON.stringify(r.json)?.slice(0, 300) || r.text?.slice(0, 300)}`)
    return { created: false }
  }
  const hash = r.json?.hash ?? r.json?.instance?.hash ?? null
  const hasQr = Boolean(r.json?.qrcode?.base64)
  record("2. Create instância descartável", true, `instanceName=${instanceName}, hash=${mask(hash)}, qrcode.base64=${hasQr ? "sim" : "não"}`)
  return { created: true }
}

// OBJETIVO Nº1: o /instance/create persistiu mesmo o nosso webhook?
async function stepWebhookCaveat(instanceName, webhookUrl) {
  const r = await evo(`/webhook/find/${instanceName}`)
  if (!r.ok) {
    record(
      "3. Webhook persistido (caveat)",
      false,
      `GET /webhook/find/${instanceName} respondeu ${r.status || r.error}. ` +
        "Não foi possível confirmar o webhook."
    )
    printWebhookFix(instanceName, webhookUrl)
    return
  }

  // A resposta pode vir achatada ou aninhada sob `webhook`. Normaliza.
  const w = r.json?.webhook ?? r.json ?? {}
  const foundUrl = w.url ?? null
  const foundEvents = Array.isArray(w.events) ? w.events : []
  const foundHeaders = w.headers ?? null
  const enabled = w.enabled ?? w.isActive ?? undefined

  const urlOk = foundUrl && trimSlash(foundUrl) === trimSlash(webhookUrl)
  const eventsOk = WEBHOOK_EVENTS.every((e) => foundEvents.includes(e))
  // O header pode não ser devolvido pela API por segurança; verifica se der.
  const headerKnown = foundHeaders && typeof foundHeaders === "object"
  const headerOk = headerKnown
    ? Object.keys(foundHeaders).some((k) => k.toLowerCase() === "x-auri-webhook-secret")
    : null // null = não verificável

  if (!foundUrl) {
    record(
      "3. Webhook persistido (caveat)",
      false,
      "O /instance/create NÃO persistiu o webhook (url vazia em /webhook/find). Este é o caveat conhecido."
    )
    printWebhookFix(instanceName, webhookUrl)
    return
  }

  if (urlOk && eventsOk && headerOk !== false) {
    const headerNote =
      headerOk === true
        ? "header X-Auri-Webhook-Secret presente"
        : "header não devolvido pela API (não verificável — confirme manualmente)"
    record(
      "3. Webhook persistido (caveat)",
      true,
      `url ok, eventos ok, ${headerNote}${enabled !== undefined ? `, enabled=${enabled}` : ""}`
    )
    return
  }

  // Persistiu parcialmente/errado.
  const problems = []
  if (!urlOk) problems.push(`url divergente (encontrada: ${foundUrl})`)
  if (!eventsOk) problems.push(`eventos faltando (encontrados: ${JSON.stringify(foundEvents)})`)
  if (headerOk === false) problems.push("header X-Auri-Webhook-Secret ausente")
  record("3. Webhook persistido (caveat)", false, problems.join("; "))
  printWebhookFix(instanceName, webhookUrl)
}

function printWebhookFix(instanceName, webhookUrl) {
  console.log("")
  console.log("  >> AÇÃO: o webhook não foi persistido corretamente pelo /instance/create.")
  console.log("     Em algumas versões do Evolution o create ignora o bloco webhook (caveat")
  console.log("     byEvents/base64 vs webhookByEvents/webhookBase64). Use o endpoint dedicado")
  console.log("     POST /webhook/set/{instance} com o envelope { webhook: {...} }:")
  console.log("")
  console.log(`     curl -X POST '${trimSlash(EVOLUTION_API_URL)}/webhook/set/${instanceName}' \\`)
  console.log(`       -H 'apikey: <EVOLUTION_API_KEY>' -H 'Content-Type: application/json' \\`)
  console.log(
    "       -d '" +
      JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          byEvents: false,
          base64: false,
          headers: { "X-Auri-Webhook-Secret": "<EVOLUTION_WEBHOOK_SECRET>" },
          events: WEBHOOK_EVENTS,
        },
      }) +
      "'"
  )
  console.log("")
  console.log("     Se for necessário, ajuste src/app/api/whatsapp/instance/route.ts (handleCreate)")
  console.log("     para chamar /webhook/set após o /instance/create.")
  console.log("")
}

async function stepConnectionState(instanceName) {
  const r = await evo(`/instance/connectionState/${instanceName}`)
  if (!r.ok) {
    record("4. connectionState", false, r.error || `status ${r.status}: ${r.text?.slice(0, 200)}`)
    return
  }
  const state = r.json?.instance?.state ?? r.json?.state ?? "(desconhecido)"
  record("4. connectionState", true, `state=${state} (esperado 'connecting'/'close' para instância nova não pareada)`)
}

async function stepCleanup(instanceName) {
  const r = await evo(`/instance/delete/${instanceName}`, { method: "DELETE" })
  if (!r.ok) {
    record("5. Cleanup (delete instância)", false, r.error || `status ${r.status}: ${r.text?.slice(0, 200)} — remova manualmente '${instanceName}' no VPS`)
    return
  }
  record("5. Cleanup (delete instância)", true, `instância '${instanceName}' removida`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("== Smoke-test de go-live do Evolution/WhatsApp (Plano 2) ==\n")

  if (!checkConfig()) {
    process.exit(1)
  }

  const instanceName = "golive_check_" + Date.now()
  const webhookUrl = `${trimSlash(NEXT_PUBLIC_APP_URL)}/api/whatsapp/ingress`
  console.log(`Instância descartável: ${instanceName}`)
  console.log(`Webhook de ingress:    ${webhookUrl}\n`)

  try {
    await stepHealth()
    const c = await stepCreate(instanceName, webhookUrl)
    if (c.created) {
      await stepWebhookCaveat(instanceName, webhookUrl)
      await stepConnectionState(instanceName)
    } else {
      console.log("(pulados os passos 3–4: a instância não foi criada)")
    }
  } finally {
    // Cleanup sempre (try/finally), best-effort — remove a instância descartável
    // mesmo se um passo anterior falhou. Se a instância não existir, o delete
    // simplesmente retorna erro e é reportado (sem quebrar o resumo).
    await stepCleanup(instanceName)
  }

  // Resumo
  console.log("\n== Resumo ==")
  const failed = results.filter((r) => !r.ok)
  for (const r of results) {
    console.log(`  ${r.ok ? "✓" : "✗"} ${r.name}`)
  }
  if (failed.length === 0) {
    console.log("\nTUDO VERDE ✓ — gateway pronto para parear um número.")
    process.exit(0)
  } else {
    console.log(`\n${failed.length} passo(s) falharam ✗ — resolva antes de seguir o go-live.`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("Erro inesperado no smoke-test:", err)
  process.exit(1)
})
