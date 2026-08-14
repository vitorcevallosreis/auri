#!/usr/bin/env node --experimental-strip-types
/**
 * Teste de integração do envio da resposta — Plano 3, Caminho A.
 * Uso: node --experimental-strip-types scripts/it-agent-send.mts
 *
 * O POST ao Evolution é stubado (globalThis.fetch): o que se prova aqui é a
 * RESOLUÇÃO — de qual canal, para qual número, por qual provider — e as
 * recusas. Um erro nessa parte manda a resposta de um paciente para outro.
 *
 * Escreve no banco e limpa no fim, inclusive em caso de falha.
 */

import { readFileSync, existsSync } from "node:fs"
import { randomUUID } from "node:crypto"

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}

const { supabaseServer } = await import("../worker/supabase.mts")
const { sendTextToChat } = await import("../worker/send.mts")

const A = {
  company: randomUUID(), assistant: randomUUID(), channel: randomUUID(),
  contact: randomUUID(), chat: randomUUID(), instance: `it-send-a-${Date.now()}`,
}
const B = {
  company: randomUUID(), assistant: randomUUID(), channel: randomUUID(),
  contact: randomUUID(), chat: randomUUID(), instance: `it-send-b-${Date.now()}`,
}

let failures = 0
function check(ok: boolean, label: string) {
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}`)
  if (!ok) failures++
}

// --- stub do fetch: registra a chamada em vez de bater no Evolution ---------
interface Captured { url: string; apikey: string | null; body: any }
let captured: Captured | null = null
let nextStatus = 200

const realFetch = globalThis.fetch

// O SUPABASE PRECISA PASSAR DIRETO. Este stub troca o `fetch` global, e o
// supabase-js resolve `globalThis.fetch` na hora da chamada — então, sem este
// desvio, TODA consulta ao banco feita lá dentro recebia a resposta falsa do
// Evolution. O sintoma era enganoso: 14 asserções falhando com "chat não
// pertence a esta clínica", como se `send.mts` tivesse um bug de tenant, quando
// o que acontecia é que a leitura do chat nunca chegava ao Postgres.
//
// (Passava antes porque o cliente capturava o `fetch` na construção. A troca
// para resolução tardia veio num bump de dependência, e este teste ficou
// quebrado em silêncio — `npm run test:integration` já morria antes de chegar
// aqui, por outro motivo.)
const SUPABASE_HOST = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host

globalThis.fetch = (async (url: any, init: any) => {
  if (String(url).includes(SUPABASE_HOST)) return realFetch(url, init)

  captured = {
    url: String(url),
    apikey: init?.headers?.apikey ?? null,
    body: JSON.parse(init?.body ?? "{}"),
  }
  return new Response(JSON.stringify({ key: { id: "EVO_MSG_1" } }), {
    status: nextStatus,
    headers: { "content-type": "application/json" },
  })
}) as typeof fetch

async function seed(t: typeof A, nome: string, provider: string) {
  await supabaseServer.from("myia_companies").insert([{ id: t.company, name: nome }])
  await supabaseServer.from("myia_assistants").insert([
    { id: t.assistant, company_id: t.company, name: `Agente ${nome}` },
  ])
  await supabaseServer.from("myia_channels").insert([
    {
      id: t.channel,
      assistant_id: t.assistant,
      nome: `Canal ${nome}`,
      provider,
      instanceWpp: t.instance,
      urlapi: "https://evolution.test",
      token: `apikey-${nome}`,
      status: "open",
    },
  ])
  await supabaseServer.from("myia_contacts").insert([
    {
      id: t.contact, company_id: t.company, name: `Paciente ${nome}`,
      number: `55119999${nome === "A" ? "1111" : "2222"}1`,
      remote_jid: `55119999${nome === "A" ? "1111" : "2222"}1@s.whatsapp.net`,
    },
  ])
  await supabaseServer.from("myia_chat").insert([
    { id: t.chat, company_id: t.company, contact_id: t.contact, instance_id: t.instance },
  ])
}

async function cleanup() {
  globalThis.fetch = realFetch
  for (const t of [A, B]) {
    await supabaseServer.from("myia_chat").delete().eq("id", t.chat)
    await supabaseServer.from("myia_contacts").delete().eq("id", t.contact)
    await supabaseServer.from("myia_channels").delete().eq("id", t.channel)
    await supabaseServer.from("myia_assistants").delete().eq("id", t.assistant)
    await supabaseServer.from("myia_companies").delete().eq("id", t.company)
  }
}

try {
  console.log("\n# fixtures")
  await seed(A, "A", "evolution")
  await seed(B, "B", "evolution")
  console.log("  criadas")

  // -------------------------------------------------------------------------
  console.log("\n# envia pelo canal certo, para o número certo")
  captured = null
  const r1 = await sendTextToChat(A.chat, A.company, "Olá, tudo bem?")

  check(r1.ok === true, `envio ok (${r1.error ?? ""})`)
  check(r1.providerMessageId === "EVO_MSG_1", "id do provedor capturado")
  check(
    captured?.url === `https://evolution.test/message/sendText/${A.instance}`,
    `URL usa a instância do chat (${captured?.url})`,
  )
  check(captured?.apikey === "apikey-A", "usa o token DO CANAL, não o global")
  // O número sai do remote_jid do contato, não do campo `number` — é o jid que
  // o WhatsApp usa para rotear.
  check(
    captured?.body?.number === "5511999911111",
    `número vem do remote_jid do contato A (${captured?.body?.number})`,
  )
  check(captured?.body?.text === "Olá, tudo bem?", "texto preservado")

  // -------------------------------------------------------------------------
  console.log("\n# recusa cross-tenant")
  captured = null
  const r2 = await sendTextToChat(B.chat, A.company, "vazamento")

  check(r2.ok === false, "chat de outra clínica é recusado")
  check(captured === null, "nenhuma requisição foi disparada")

  // -------------------------------------------------------------------------
  console.log("\n# canal 'cloud' não envia enquanto não validado contra a Meta")
  await supabaseServer.from("myia_channels").update({ provider: "cloud" }).eq("id", A.channel)

  captured = null
  const r3 = await sendTextToChat(A.chat, A.company, "não deve sair")

  check(r3.ok === false, "provider cloud recusa")
  check(
    (r3.error ?? "").includes("não validado"),
    `erro explica o motivo (${r3.error})`,
  )
  check(captured === null, "nada foi enviado pelo caminho errado")

  await supabaseServer.from("myia_channels").update({ provider: "evolution" }).eq("id", A.channel)

  // -------------------------------------------------------------------------
  console.log("\n# erro do provedor não vira sucesso silencioso")
  nextStatus = 500
  const r4 = await sendTextToChat(A.chat, A.company, "vai falhar")
  check(r4.ok === false, "HTTP 500 do Evolution é falha")
  check((r4.error ?? "").includes("500"), `erro carrega o status (${r4.error?.slice(0, 40)})`)
  nextStatus = 200

  // -------------------------------------------------------------------------
  console.log("\n# canal sem urlapi/token cai para a env global do Evolution")
  // Comportamento herdado de /api/messages/send: num self-host de instância
  // única, o canal pode não ter as credenciais gravadas e o worker usa as
  // globais. Documentado aqui porque a alternativa (falhar) seria silenciosa.
  await supabaseServer.from("myia_channels").update({ urlapi: null, token: null }).eq("id", A.channel)

  const envUrl = process.env.EVOLUTION_API_URL
  const envKey = process.env.EVOLUTION_API_KEY

  captured = null
  const r5 = await sendTextToChat(A.chat, A.company, "usa env global")

  if (envUrl && envKey) {
    check(r5.ok === true, `usa a env global quando o canal não tem (${r5.error ?? ""})`)
    check(
      captured?.url?.startsWith(envUrl.replace(/\/$/, "")) === true,
      `URL veio da env (${captured?.url})`,
    )
  } else {
    check(r5.ok === false, "sem canal e sem env, falha explícita")
  }

  // -------------------------------------------------------------------------
  console.log("\n# sem canal E sem env: erro tratado, não exceção")
  delete process.env.EVOLUTION_API_URL
  delete process.env.EVOLUTION_API_KEY

  captured = null
  const r6 = await sendTextToChat(A.chat, A.company, "sem nada")

  check(
    r6.ok === false && (r6.error ?? "").includes("incompleta"),
    `config ausente é tratada (${r6.error})`,
  )
  check(captured === null, "nada foi disparado sem configuração")

  if (envUrl) process.env.EVOLUTION_API_URL = envUrl
  if (envKey) process.env.EVOLUTION_API_KEY = envKey
} finally {
  console.log("\n# limpeza")
  await cleanup()
  console.log("  removidas")
}

console.log(failures === 0 ? "\nPASS" : `\nFAIL — ${failures} asserção(ões)`)
process.exit(failures === 0 ? 0 : 1)
