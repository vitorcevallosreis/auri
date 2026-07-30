import { createHmac, timingSafeEqual } from "crypto"
import type {
  ChannelAdapter,
  InboundMessage,
  OutboundTemplate,
  OutboundText,
  SendResult,
} from "./ChannelAdapter"

/**
 * Adaptador da Meta WhatsApp Cloud API (Graph API).
 *
 * SERVIDOR APENAS — carrega o App Secret e recebe o access token do tenant.
 *
 * O token NÃO é lido de env: na Cloud API com Embedded Signup cada clínica tem
 * o próprio token, guardado cifrado em myia_wa_cloud_numbers. Quem chama
 * resolve o tenant, decifra e passa aqui.
 */

const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v21.0"
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

interface CloudApiAdapterOptions {
  /** App Secret do app Meta — verifica a assinatura do webhook. */
  appSecret: string
  /**
   * Resolve o access token do número. Assíncrono porque envolve ler a linha e
   * decifrar; o adaptador não conhece o banco.
   */
  resolveToken: (phoneNumberId: string) => Promise<string>
}

export class CloudApiAdapter implements ChannelAdapter {
  // Campo explícito em vez de parameter property (`constructor(private opts)`).
  // Parameter property exige transformação de código, e o type stripping nativo
  // do Node só apaga tipos — com ela, os testes em scripts/test-cloud-adapter.mts
  // não conseguem importar este módulo sem adicionar um transpilador ao projeto.
  private readonly opts: CloudApiAdapterOptions

  constructor(opts: CloudApiAdapterOptions) {
    this.opts = opts
  }

  // -------------------------------------------------------------------------
  // Webhook
  // -------------------------------------------------------------------------

  /**
   * A Meta assina o corpo cru com HMAC-SHA256 usando o App Secret e manda em
   * `X-Hub-Signature-256: sha256=<hex>`.
   *
   * Duas armadilhas: (1) tem que ser o corpo CRU, byte a byte — reserializar o
   * JSON muda os bytes e quebra o MAC; (2) comparação precisa ser time-safe,
   * senão vaza o dígito certo por tempo de resposta.
   */
  verifyWebhook(rawBody: string, signatureHeader: string | null): boolean {
    if (!signatureHeader?.startsWith("sha256=")) return false

    const received = Buffer.from(signatureHeader.slice("sha256=".length), "hex")

    const expected = createHmac("sha256", this.opts.appSecret)
      .update(rawBody, "utf8")
      .digest()

    // timingSafeEqual joga se os tamanhos diferem — checar antes.
    if (received.length !== expected.length) return false

    return timingSafeEqual(received, expected)
  }

  /**
   * Um POST pode trazer várias entries, cada uma com vários changes, cada um
   * com várias mensagens — e de números diferentes. Achatamos tudo, mantendo
   * em cada item o phone_number_id que recebeu, que é o que resolve o tenant.
   *
   * `statuses` (entregue/lido/falhou) chega no mesmo formato e é ignorado aqui:
   * não é mensagem de paciente. Tratado em fase posterior.
   */
  parseInbound(body: unknown): InboundMessage[] {
    const out: InboundMessage[] = []
    const payload = body as CloudWebhookBody

    if (payload?.object !== "whatsapp_business_account") return out

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value
        if (!value?.messages?.length) continue

        const phoneNumberId = value.metadata?.phone_number_id
        if (!phoneNumberId) continue

        // pushName vem em contacts[], paralelo a messages[], casado por wa_id.
        const namesByWaId = new Map<string, string>()
        for (const c of value.contacts ?? []) {
          if (c.wa_id && c.profile?.name) namesByWaId.set(c.wa_id, c.profile.name)
        }

        for (const msg of value.messages) {
          if (!msg.id || !msg.from) continue

          out.push({
            providerMessageId: msg.id,
            from: msg.from,
            phoneNumberId,
            pushName: namesByWaId.get(msg.from),
            timestamp: Number(msg.timestamp) || Math.floor(Date.now() / 1000),
            type: msg.type ?? "unknown",
            text: extractText(msg),
            raw: msg as unknown as Record<string, unknown>,
          })
        }
      }
    }

    return out
  }

  // -------------------------------------------------------------------------
  // Envio
  // -------------------------------------------------------------------------

  async send(
    phoneNumberId: string,
    to: string,
    message: OutboundText,
  ): Promise<SendResult> {
    return this.post(phoneNumberId, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body: message.body, preview_url: false },
    })
  }

  async sendTemplate(
    phoneNumberId: string,
    to: string,
    message: OutboundTemplate,
  ): Promise<SendResult> {
    const components = message.variables?.length
      ? [
          {
            type: "body",
            parameters: message.variables.map((text) => ({
              type: "text",
              text,
            })),
          },
        ]
      : undefined

    return this.post(phoneNumberId, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: message.name,
        language: { code: message.language },
        ...(components ? { components } : {}),
      },
    })
  }

  private async post(
    phoneNumberId: string,
    payload: Record<string, unknown>,
  ): Promise<SendResult> {
    const token = await this.opts.resolveToken(phoneNumberId)

    const response = await fetch(`${GRAPH_BASE}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const json = (await response.json().catch(() => null)) as
      | GraphSendResponse
      | GraphErrorResponse
      | null

    if (!response.ok) {
      // A Meta devolve erro estruturado; preservar code/subcode é o que permite
      // distinguir "fora da janela de 24h" de "token expirado" mais tarde.
      const err = (json as GraphErrorResponse | null)?.error
      throw new CloudApiError(
        err?.message ?? `Graph API respondeu ${response.status}`,
        {
          status: response.status,
          code: err?.code,
          subcode: err?.error_subcode,
          type: err?.type,
        },
      )
    }

    const id = (json as GraphSendResponse | null)?.messages?.[0]?.id

    if (!id) {
      throw new CloudApiError("Graph API respondeu 200 sem id de mensagem", {
        status: response.status,
      })
    }

    return { providerMessageId: id }
  }
}

export class CloudApiError extends Error {
  readonly status?: number
  readonly code?: number
  readonly subcode?: number
  readonly metaType?: string

  constructor(
    message: string,
    meta: { status?: number; code?: number; subcode?: number; type?: string },
  ) {
    super(message)
    this.name = "CloudApiError"
    this.status = meta.status
    this.code = meta.code
    this.subcode = meta.subcode
    this.metaType = meta.type
  }
}

// ---------------------------------------------------------------------------
// Extração de texto
// ---------------------------------------------------------------------------

function extractText(msg: CloudMessage): string | null {
  switch (msg.type) {
    case "text":
      return msg.text?.body ?? null
    // Botões e listas devolvem a escolha do usuário; para o agente isso é texto.
    case "button":
      return msg.button?.text ?? null
    case "interactive":
      return (
        msg.interactive?.button_reply?.title ??
        msg.interactive?.list_reply?.title ??
        null
      )
    // Mídia entra em fase posterior; a legenda já é útil e o raw fica gravado.
    case "image":
    case "video":
    case "document":
      return msg.image?.caption ?? msg.video?.caption ?? msg.document?.caption ?? null
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Formato do webhook (só o que consumimos)
// ---------------------------------------------------------------------------

interface CloudWebhookBody {
  object?: string
  entry?: Array<{
    id?: string
    changes?: Array<{
      field?: string
      value?: {
        metadata?: { phone_number_id?: string; display_phone_number?: string }
        contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>
        messages?: CloudMessage[]
      }
    }>
  }>
}

interface CloudMessage {
  id?: string
  from?: string
  timestamp?: string
  type?: string
  text?: { body?: string }
  button?: { text?: string }
  interactive?: {
    button_reply?: { title?: string }
    list_reply?: { title?: string }
  }
  image?: { caption?: string }
  video?: { caption?: string }
  document?: { caption?: string }
}

interface GraphSendResponse {
  messages?: Array<{ id?: string }>
}

interface GraphErrorResponse {
  error?: {
    message?: string
    type?: string
    code?: number
    error_subcode?: number
  }
}
