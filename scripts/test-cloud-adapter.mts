#!/usr/bin/env node --experimental-strip-types
/**
 * Testes do CloudApiAdapter — Plano 3, P3.1.
 *
 * Uso: node --experimental-strip-types scripts/test-cloud-adapter.mts
 *
 * Sem framework de teste no projeto (não há jest/vitest/tsx), então usa o
 * runner nativo do Node 22 com type stripping. Cobre as duas partes que não
 * podem estar erradas: verificação de assinatura e parsing do webhook.
 *
 * Nenhuma rede: `send`/`sendTemplate` batem na Graph API e ficam para o teste
 * de integração, quando as credenciais da Meta existirem (P3.0).
 */

import { test } from "node:test"
import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { CloudApiAdapter } from "../src/lib/whatsapp/CloudApiAdapter.ts"

const APP_SECRET = "segredo-de-teste-nao-usar-em-producao"

const adapter = new CloudApiAdapter({
  appSecret: APP_SECRET,
  resolveToken: async () => "token-fake",
})

function sign(body: string, secret = APP_SECRET): string {
  return "sha256=" + createHmac("sha256", secret).update(body, "utf8").digest("hex")
}

// ---------------------------------------------------------------------------
// Assinatura
// ---------------------------------------------------------------------------

test("aceita assinatura correta", () => {
  const body = JSON.stringify({ object: "whatsapp_business_account" })
  assert.equal(adapter.verifyWebhook(body, sign(body)), true)
})

test("rejeita assinatura de outro segredo", () => {
  const body = JSON.stringify({ object: "whatsapp_business_account" })
  assert.equal(adapter.verifyWebhook(body, sign(body, "outro-segredo")), false)
})

test("rejeita corpo adulterado", () => {
  const original = JSON.stringify({ object: "whatsapp_business_account", n: 1 })
  const signature = sign(original)
  const tampered = JSON.stringify({ object: "whatsapp_business_account", n: 2 })
  assert.equal(adapter.verifyWebhook(tampered, signature), false)
})

test("rejeita header ausente, vazio ou sem prefixo sha256=", () => {
  const body = "{}"
  assert.equal(adapter.verifyWebhook(body, null), false)
  assert.equal(adapter.verifyWebhook(body, ""), false)
  assert.equal(adapter.verifyWebhook(body, "deadbeef"), false)
  assert.equal(adapter.verifyWebhook(body, "sha1=deadbeef"), false)
})

test("rejeita assinatura de tamanho errado sem lançar", () => {
  // timingSafeEqual joga quando os buffers têm tamanhos diferentes; o adaptador
  // precisa checar o tamanho antes, senão um header curto derruba a rota com
  // 500 em vez de responder 401.
  const body = "{}"
  assert.doesNotThrow(() => adapter.verifyWebhook(body, "sha256=ab"))
  assert.equal(adapter.verifyWebhook(body, "sha256=ab"), false)
})

test("rejeita assinatura não-hexadecimal sem lançar", () => {
  const body = "{}"
  assert.doesNotThrow(() => adapter.verifyWebhook(body, "sha256=zzzz"))
})

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function webhook(messages: unknown[], contacts: unknown[] = []) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_ID",
        changes: [
          {
            field: "messages",
            value: {
              metadata: {
                phone_number_id: "PHONE_1",
                display_phone_number: "5511999999999",
              },
              contacts,
              messages,
            },
          },
        ],
      },
    ],
  }
}

test("extrai mensagem de texto com pushName", () => {
  const parsed = adapter.parseInbound(
    webhook(
      [
        {
          id: "wamid.ABC",
          from: "5511888888888",
          timestamp: "1770000000",
          type: "text",
          text: { body: "quero marcar consulta" },
        },
      ],
      [{ wa_id: "5511888888888", profile: { name: "Maria" } }],
    ),
  )

  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].providerMessageId, "wamid.ABC")
  assert.equal(parsed[0].from, "5511888888888")
  assert.equal(parsed[0].phoneNumberId, "PHONE_1")
  assert.equal(parsed[0].pushName, "Maria")
  assert.equal(parsed[0].text, "quero marcar consulta")
  assert.equal(parsed[0].timestamp, 1770000000)
})

test("achata várias mensagens de vários números", () => {
  const parsed = adapter.parseInbound({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "PHONE_1" },
              messages: [
                { id: "w1", from: "111", timestamp: "1", type: "text", text: { body: "a" } },
                { id: "w2", from: "222", timestamp: "2", type: "text", text: { body: "b" } },
              ],
            },
          },
          {
            value: {
              metadata: { phone_number_id: "PHONE_2" },
              messages: [
                { id: "w3", from: "333", timestamp: "3", type: "text", text: { body: "c" } },
              ],
            },
          },
        ],
      },
    ],
  })

  assert.equal(parsed.length, 3)
  assert.deepEqual(
    parsed.map((m) => m.phoneNumberId),
    ["PHONE_1", "PHONE_1", "PHONE_2"],
  )
})

test("lê resposta de botão interativo como texto", () => {
  const parsed = adapter.parseInbound(
    webhook([
      {
        id: "wamid.BTN",
        from: "111",
        timestamp: "1",
        type: "interactive",
        interactive: { button_reply: { id: "confirmar", title: "Confirmar" } },
      },
    ]),
  )

  assert.equal(parsed[0].text, "Confirmar")
})

test("mídia sem legenda entra com text null mas preserva o raw", () => {
  const parsed = adapter.parseInbound(
    webhook([
      { id: "wamid.IMG", from: "111", timestamp: "1", type: "image", image: { mime_type: "image/jpeg" } },
    ]),
  )

  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].text, null)
  assert.equal(parsed[0].type, "image")
  // O payload cru é gravado inteiro para não perder informação de mídia.
  assert.equal((parsed[0].raw as Record<string, unknown>).id, "wamid.IMG")
})

test("ignora payloads que não são mensagem", () => {
  // statuses (entregue/lido) chegam no mesmo envelope e não são mensagem.
  assert.deepEqual(
    adapter.parseInbound({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "PHONE_1" },
                statuses: [{ id: "wamid.X", status: "delivered" }],
              },
            },
          ],
        },
      ],
    }),
    [],
  )

  assert.deepEqual(adapter.parseInbound({ object: "outra_coisa" }), [])
  assert.deepEqual(adapter.parseInbound({}), [])
  assert.deepEqual(adapter.parseInbound(null), [])
})

test("descarta mensagem sem id ou sem from", () => {
  const parsed = adapter.parseInbound(
    webhook([
      { from: "111", timestamp: "1", type: "text", text: { body: "sem id" } },
      { id: "w2", timestamp: "1", type: "text", text: { body: "sem from" } },
      { id: "w3", from: "333", timestamp: "1", type: "text", text: { body: "ok" } },
    ]),
  )

  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].providerMessageId, "w3")
})

test("descarta change sem phone_number_id (tenant indeterminável)", () => {
  const parsed = adapter.parseInbound({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              metadata: {},
              messages: [{ id: "w1", from: "111", timestamp: "1", type: "text", text: { body: "a" } }],
            },
          },
        ],
      },
    ],
  })

  assert.deepEqual(parsed, [])
})
