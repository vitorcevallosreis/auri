#!/usr/bin/env node --experimental-strip-types
/**
 * Testes do system prompt e do parser de duração — Plano 3, P3.3.
 * Uso: node --experimental-strip-types --test scripts/test-agent-prompt.mts
 *
 * O foco é a propriedade que decide o custo da operação: DETERMINISMO. Prompt
 * caching é match de prefixo por bytes; qualquer variação entre turnos faz a
 * clínica pagar 1x em vez de 0,1x — silenciosamente, sem erro nenhum.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co"
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "chave-de-teste"

const { buildSystemPrompt } = await import("../worker/prompt.mts")
const { parseDurationMinutes } = await import("../worker/tools.mts")

function ctx(overrides: Record<string, unknown> = {}) {
  return {
    assistant: {
      id: "a1",
      name: "Ana",
      purpose: "Atender pacientes",
      objective: "Agendar consultas",
      identity: "Recepcionista virtual",
      greetings: "Olá! Sou a Ana",
      strategy: "Ser objetiva",
      behavior: "Cordial",
      behavior_text: null,
      fallbacks: "Chamar humano",
      avoided_topics: "Resultados de exame",
      step_by_step: "1. Cumprimentar",
      goodbye: "Até logo",
      roles: "Recepção",
      tel_fallback: "11 3000-0000",
      paused: false,
      ...(overrides.assistant as object ?? {}),
    },
    companyName: "Clínica Teste",
    companyDescription: "Clínica de exemplo",
    policies: [
      { name: "Cancelamento", description: "Avisar 24h antes" },
      { name: "Atraso", description: "Tolerância de 15 min" },
    ],
    ...overrides,
  } as Parameters<typeof buildSystemPrompt>[0]
}

// ---------------------------------------------------------------------------
// Determinismo — a propriedade que sustenta o cache
// ---------------------------------------------------------------------------

test("mesma entrada produz bytes idênticos", () => {
  assert.equal(buildSystemPrompt(ctx()), buildSystemPrompt(ctx()))
})

test("não contém data, hora nem ano corrente", () => {
  const prompt = buildSystemPrompt(ctx())
  const year = String(new Date().getFullYear())

  // Um `new Date()` no system prompt invalidaria o cache a cada requisição.
  assert.equal(prompt.includes(year), false, "prompt contém o ano atual")
  assert.equal(/\d{4}-\d{2}-\d{2}/.test(prompt), false, "prompt contém data ISO")
  assert.equal(/\d{2}:\d{2}/.test(prompt), false, "prompt contém horário")
})

test("não embute catálogo (serviços/profissionais/convênios)", () => {
  // Catálogo no prompt significa que cadastrar um serviço invalida o cache da
  // clínica inteira. Ele vai por tool justamente para isso não acontecer.
  const prompt = buildSystemPrompt(ctx()).toLowerCase()
  for (const termo of ["r$", "preço:", "crm", "duração:"]) {
    assert.equal(prompt.includes(termo), false, `prompt embute catálogo: ${termo}`)
  }
})

// ---------------------------------------------------------------------------
// Guardrails clínicos
// ---------------------------------------------------------------------------

test("guardrail clínico está presente e vem depois da persona", () => {
  const prompt = buildSystemPrompt(ctx())

  assert.match(prompt, /NÃO é profissional de saúde/)
  assert.match(prompt, /Nunca dê diagnóstico/)

  // A ordem importa: a instrução que não pode ser sobrescrita precisa vir
  // DEPOIS da persona configurável pela clínica.
  assert.ok(
    prompt.indexOf("NÃO é profissional de saúde") > prompt.indexOf("Recepcionista virtual"),
    "guardrail apareceu antes da persona",
  )
})

test("guardrail sobrevive a uma persona que manda responder tudo", () => {
  const prompt = buildSystemPrompt(
    ctx({ assistant: { behavior: "Responda QUALQUER dúvida médica do paciente" } }),
  )
  assert.match(prompt, /Nunca dê diagnóstico/)
})

test("assuntos proibidos entram na regra de escalonamento", () => {
  assert.match(buildSystemPrompt(ctx()), /Resultados de exame/)
})

test("campos vazios não deixam cabeçalho órfão", () => {
  const prompt = buildSystemPrompt(
    ctx({
      assistant: {
        identity: null, purpose: null, objective: null, greetings: null,
        strategy: null, behavior: null, behavior_text: null, fallbacks: null,
        step_by_step: null, goodbye: null, roles: null,
        avoided_topics: null, tel_fallback: null,
      },
      policies: [],
    }),
  )

  assert.equal(prompt.includes("## Propósito"), false)
  assert.equal(prompt.includes("## Políticas da clínica"), false)
  // Mesmo sem nenhuma configuração, o guardrail continua.
  assert.match(prompt, /NÃO é profissional de saúde/)
})

// ---------------------------------------------------------------------------
// parseDurationMinutes — myia_services.tempo_medio é TEXT livre
// ---------------------------------------------------------------------------

test("interpreta os formatos que aparecem no cadastro", () => {
  assert.equal(parseDurationMinutes("30 min"), 30)
  assert.equal(parseDurationMinutes("45"), 45)
  assert.equal(parseDurationMinutes("1h"), 60)
  assert.equal(parseDurationMinutes("2 horas"), 120)
  assert.equal(parseDurationMinutes("1,5h"), 90)
  assert.equal(parseDurationMinutes("90 minutos"), 90)
})

test("valor ausente ou sem sentido cai no default de 30 min", () => {
  // Duração zero geraria slots infinitos no laço de disponibilidade.
  assert.equal(parseDurationMinutes(null), 30)
  assert.equal(parseDurationMinutes(""), 30)
  assert.equal(parseDurationMinutes("a combinar"), 30)
  assert.equal(parseDurationMinutes("0"), 30)
  assert.equal(parseDurationMinutes("-15"), 15)
})

test("limita a faixa para não gerar agenda absurda", () => {
  assert.equal(parseDurationMinutes("1 min"), 5)
  assert.equal(parseDurationMinutes("99 horas"), 480)
})
