#!/usr/bin/env node --experimental-strip-types
/**
 * Turno REAL do agente — bate na API da Anthropic e no banco de produção.
 * Uso: node --experimental-strip-types scripts/live-agent-turn.mts "mensagem do paciente"
 *
 * ⚠️ ESTE SCRIPT CUSTA DINHEIRO. Não é um teste de integração; não entra no
 * `npm run test:integration`. Ele existe porque `worker/agentTurn.mts` tem 392
 * linhas que nunca executaram contra o modelo de verdade, e os testes de
 * integração stubam o `fetch` justamente para não gastar — então nenhum deles
 * prova que o toolRunner fecha o laço.
 *
 * O que ele NÃO faz: enviar pelo WhatsApp. `AGENT_SEND_ENABLED` fica como está
 * no `.env.local` (hoje `false`), e a resposta é gravada como mensagem
 * pendente — dá para ler o que o agente TERIA mandado antes de qualquer
 * paciente ver.
 *
 * Usa a empresa e o assistente REAIS da Clínica A, porque o valor do teste
 * está justamente nas ferramentas acharem serviço, profissional e agenda de
 * verdade. Só o contato e o chat são descartáveis, com prefixo `feed0000`, e
 * são apagados no fim mesmo se der erro.
 */

import { readFileSync, existsSync } from "node:fs"

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY ausente — nada a fazer.")
  process.exit(2)
}

const COMPANY = process.env.LIVE_COMPANY_ID ?? "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

// DOIS turnos por padrão, e não um. O primeiro prova que o laço fecha; o
// SEGUNDO é o único que prova o cache, porque `cache_read_input_tokens` só
// pode ser > 0 quando já existe prefixo gravado. Um turno só deixaria passar
// a falha mais cara do sistema — prompt volátil antes do breakpoint, clínica
// pagando 10x, e nenhum erro em lugar nenhum.
const FALAS = process.argv.slice(2)
if (FALAS.length === 0) {
  FALAS.push("Oi! Gostaria de marcar uma consulta. Que horários vocês têm?")
  FALAS.push("Pode ser na quarta de manhã. Meu nome é Vitor Cevallos.")
}

const { supabaseServer } = await import("../worker/supabase.mts")
const { processAgentTurn } = await import("../worker/agentTurn.mts")

// Prefixo próprio, fora da faixa dos seeds (d8/da/db) e fora de qualquer id
// real — é o que garante que a limpeza no fim não alcance dado de verdade.
const T = {
  contact: "feed0001-0000-4000-8000-000000000001",
  chat: "feed0001-0000-4000-8000-000000000002",
  job: "feed0001-0000-4000-8000-000000000003",
}

async function limpar() {
  // `myia_agent_runs.chat_id` é ON DELETE CASCADE, então apagar o chat apaga
  // também o run e as tool_calls. Não há como "preservar o run e limpar o
  // chat": por isso TUDO é impresso antes daqui, e o relatório no terminal é a
  // evidência que sobrevive. Passe LIVE_KEEP=1 para deixar no banco e olhar
  // pelo painel.
  if (process.env.LIVE_KEEP === "1") {
    console.log("\n(LIVE_KEEP=1 — chat de teste MANTIDO no banco; apague depois)")
    return
  }
  await supabaseServer.from("myia_messages").delete().eq("chat_id", T.chat)
  await supabaseServer.from("myia_agent_jobs").delete().eq("id", T.job)
  await supabaseServer.from("myia_chat").delete().eq("id", T.chat)
  await supabaseServer.from("myia_contacts").delete().eq("id", T.contact)
}

try {
  const { data: assistente } = await supabaseServer
    .from("myia_assistants")
    .select("id, name, paused")
    .eq("company_id", COMPANY)
    .limit(1)
    .maybeSingle()

  if (!assistente) throw new Error(`empresa ${COMPANY} não tem assistente`)
  console.log(`assistente: ${assistente.name} (${assistente.id}), pausado=${assistente.paused}`)
  console.log(`modelo: ${process.env.AGENT_MODEL ?? "claude-opus-5"}`)
  console.log(`envio: AGENT_SEND_ENABLED=${process.env.AGENT_SEND_ENABLED}`)

  await limpar()

  await supabaseServer.from("myia_contacts").insert([
    {
      id: T.contact,
      company_id: COMPANY,
      name: "Paciente Teste (live)",
      number: "5511900000002",
      remote_jid: "5511900000002@s.whatsapp.net",
    },
  ])
  await supabaseServer.from("myia_chat").insert([
    { id: T.chat, company_id: COMPANY, contact_id: T.contact, instance_id: "live-turn" },
  ])
  // O job tem de existir de verdade: `openRun` grava `job_id` com FK, e sem a
  // linha o turno morre em "violates foreign key constraint" antes de chamar o
  // modelo. O worker cria este job no enqueue; aqui somos nós o enqueue.
  const { error: eJob } = await supabaseServer.from("myia_agent_jobs").insert([
    {
      id: T.job,
      company_id: COMPANY,
      chat_id: T.chat,
      assistant_id: assistente.id,
      status: "running",
      locked_at: new Date().toISOString(),
      locked_by: "live-agent-turn",
    },
  ])
  if (eJob) throw new Error(`falha ao criar job: ${eJob.message}`)

  for (const [i, fala] of FALAS.entries()) {
    const { error: eMsg } = await supabaseServer.from("myia_messages").insert([
      {
        chat_id: T.chat,
        from_me: false,
        message_id: `live-${Date.now()}-${i}`,
        message_type: "conversation",
        // `extractText` lê `conversation` primeiro — mesmo formato que o
        // Evolution entrega no webhook.
        message: { conversation: fala },
        message_timestamp: Math.floor(Date.now() / 1000),
        status: "RECEIVED",
      },
    ])
    if (eMsg) throw new Error(`falha ao inserir mensagem: ${eMsg.message}`)

    console.log(`\n── TURNO ${i + 1} ──`)
    console.log(`PACIENTE: ${fala}`)

    const t0 = Date.now()
    const r = await processAgentTurn({
      id: T.job,
      company_id: COMPANY,
      chat_id: T.chat,
      assistant_id: assistente.id,
      status: "running",
      run_after: new Date().toISOString(),
      attempts: 0,
      max_attempts: 3,
      locked_at: new Date().toISOString(),
      locked_by: "live-agent-turn",
      last_error: null,
    })
    console.log(`  → ${r.summary}   (${((Date.now() - t0) / 1000).toFixed(1)}s)`)

    const { data: ultima } = await supabaseServer
      .from("myia_messages")
      .select("message, status")
      .eq("chat_id", T.chat)
      .eq("from_me", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (ultima) {
      const texto = (ultima.message as any)?.conversation ?? JSON.stringify(ultima.message)
      console.log(`AGENTE [${ultima.status}]: ${texto}`)
    } else {
      console.log("AGENTE: (nada gravado)")
    }
  }

  // --- runs, tokens e ferramentas -------------------------------------------
  const { data: runs } = await supabaseServer
    .from("myia_agent_runs")
    .select("*")
    .eq("chat_id", T.chat)
    .order("created_at", { ascending: true })

  for (const [i, run] of (runs ?? []).entries()) {
    console.log(`\n=== run ${i + 1} (${run.id}) ===`)
    console.log(JSON.stringify(run, null, 2))

    const { data: calls } = await supabaseServer
      .from("myia_agent_tool_calls")
      .select("tool_name, is_error, duration_ms, output")
      .eq("run_id", run.id)
      .order("created_at", { ascending: true })

    console.log(`  ferramentas (${calls?.length ?? 0}):`)
    for (const c of calls ?? []) {
      console.log(
        `  ${c.is_error ? "ERRO " : "ok   "} ${c.tool_name} (${c.duration_ms}ms) ` +
          `${JSON.stringify(c.output)?.slice(0, 240)}`,
      )
    }
  }

  // O VEREDITO DO CACHE. Sem esta linha o teste não vale: leitura zero no
  // segundo turno significa prefixo volátil e conta 10x maior, sem erro nenhum
  // aparecendo em lugar algum.
  const segundo = runs?.[1]
  if (segundo) {
    const lido = (segundo as any).cache_read_tokens ?? (segundo as any).cache_read_input_tokens
    console.log(
      `\nCACHE no 2º turno: ${lido} tokens lidos — ` +
        `${Number(lido) > 0 ? "OK, o prefixo está estável" : "ZERO: algo volátil entrou antes do breakpoint"}`,
    )
  }
} catch (e) {
  console.error("\nFALHOU:", e instanceof Error ? e.message : e)
  if (e instanceof Error && e.stack) console.error(e.stack.split("\n").slice(1, 6).join("\n"))
  process.exitCode = 1
} finally {
  await limpar()
}
