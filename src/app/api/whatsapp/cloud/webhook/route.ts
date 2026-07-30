import { NextResponse } from "next/server"
import { getCloudAdapter, resolveTenantByPhoneNumberId } from "@/lib/whatsapp/cloudChannel"
import { persistInboundMessage } from "@/lib/whatsapp/persistInbound"

/**
 * Webhook da Meta WhatsApp Cloud API — Plano 3, P3.1.
 *
 * Substitui /api/whatsapp/ingress (Evolution). Duas rotas no mesmo arquivo,
 * como a Meta exige:
 *
 *   GET  — handshake de verificação (hub.challenge), uma vez, ao registrar
 *   POST — entrega de eventos, assinada com HMAC-SHA256
 *
 * Contrato de latência: a Meta reentrega se não receber 200 em ~5s. Este
 * handler só valida, resolve o tenant e persiste; o turno do agente (que leva
 * segundos) roda no worker do P3.2, fora do caminho da requisição.
 *
 * Nota de segurança: o middleware exclui /api/* do matcher, então esta rota não
 * recebe autenticação nenhuma dele. A autenticidade vem exclusivamente da
 * assinatura HMAC verificada abaixo.
 */

export const dynamic = "force-dynamic"

// ---------------------------------------------------------------------------
// GET — handshake de verificação
// ---------------------------------------------------------------------------
export async function GET(req: Request) {
  const url = new URL(req.url)
  const mode = url.searchParams.get("hub.mode")
  const token = url.searchParams.get("hub.verify_token")
  const challenge = url.searchParams.get("hub.challenge")

  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN

  if (!expected) {
    console.error("[wa/cloud] META_WEBHOOK_VERIFY_TOKEN não configurado")
    return new NextResponse("Webhook not configured", { status: 500 })
  }

  if (mode !== "subscribe" || token !== expected) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  // A Meta espera o challenge cru em text/plain — JSON aqui reprova o handshake.
  return new NextResponse(challenge ?? "", {
    status: 200,
    headers: { "content-type": "text/plain" },
  })
}

// ---------------------------------------------------------------------------
// POST — entrega de eventos
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  // (1) Corpo CRU. Precisa ser a string exata recebida: o HMAC é sobre os bytes,
  //     e um req.json() seguido de re-serialização muda o payload e quebra o MAC.
  const rawBody = await req.text()

  let adapter
  try {
    adapter = getCloudAdapter()
  } catch (error) {
    console.error("[wa/cloud] adaptador não configurado:", error)
    return NextResponse.json({ error: "Not configured" }, { status: 500 })
  }

  // (2) Autenticidade. Falha fechado.
  const signature = req.headers.get("x-hub-signature-256")

  if (!adapter.verifyWebhook(rawBody, signature)) {
    console.warn("[wa/cloud] assinatura inválida — payload descartado")
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    // Assinatura confere mas o corpo não é JSON: nada a reprocessar, ack.
    return NextResponse.json({ ok: true, ignored: "invalid_json" })
  }

  // (3) Um POST pode trazer várias mensagens, de números diferentes.
  const inbound = adapter.parseInbound(body)

  if (inbound.length === 0) {
    // Status de entrega/leitura, eventos de conta, etc. Ainda não tratados.
    return NextResponse.json({ ok: true, ignored: "no_messages" })
  }

  const tenantCache = new Map<
    string,
    Awaited<ReturnType<typeof resolveTenantByPhoneNumberId>>
  >()

  let persisted = 0
  let duplicates = 0
  let unknown = 0

  for (const msg of inbound) {
    try {
      // (4) Tenant a partir do phone_number_id — única entrada de company_id.
      if (!tenantCache.has(msg.phoneNumberId)) {
        tenantCache.set(
          msg.phoneNumberId,
          await resolveTenantByPhoneNumberId(msg.phoneNumberId),
        )
      }
      const tenant = tenantCache.get(msg.phoneNumberId)

      if (!tenant) {
        // Número que não é nosso ou ainda não vinculado. Ack sem gravar: 4xx
        // aqui só faria a Meta reentregar para sempre.
        unknown++
        continue
      }

      // (5) Persiste. Idempotente via uq_messages_instance_msgid.
      const result = await persistInboundMessage(msg, tenant)

      if (result.inserted) {
        persisted++

        // (6) P3.2 enfileira o turno do agente aqui. Enquanto a fila não
        //     existe, a mensagem já aparece na inbox por Realtime e um humano
        //     responde — degradação aceitável, e nada se perde.
        //     Sem assistente vinculado, não há o que enfileirar de todo jeito.
        if (tenant.assistantId) {
          // TODO(P3.2): enqueueAgentTurn({ chatId: result.chatId, ... })
        }
      } else {
        duplicates++
      }
    } catch (error) {
      // Uma mensagem ruim não pode derrubar o lote inteiro nem provocar
      // reentrega das que já gravaram.
      console.error("[wa/cloud] falha ao processar mensagem", {
        providerMessageId: msg.providerMessageId,
        phoneNumberId: msg.phoneNumberId,
        error,
      })
    }
  }

  return NextResponse.json({ ok: true, persisted, duplicates, unknown })
}
