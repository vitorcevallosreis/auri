/**
 * Contrato mínimo entre o agente e o transporte de mensagens.
 *
 * Escopo desta interface é deliberadamente pequeno. Ela NÃO existe para
 * suportar múltiplos provedores em produção — a decisão do Plano 3 foi que a
 * Cloud API substitui o Evolution, e o código do Evolution sai. Ela existe como
 * costura de teste: permite um FakeAdapter nos testes do worker sem bater na
 * Graph API da Meta.
 *
 * Se um dia entrar um segundo canal de verdade (Instagram DM, widget web), ela
 * já serve — mas não é para isso que está aqui hoje, e não deve crescer
 * "por precaução".
 */

export interface OutboundText {
  type: "text"
  body: string
}

export interface OutboundTemplate {
  type: "template"
  /** Nome do template aprovado na Meta. */
  name: string
  /** Código de idioma, ex.: "pt_BR". */
  language: string
  /** Variáveis posicionais do corpo, na ordem em que aparecem. */
  variables?: string[]
}

export type OutboundMessage = OutboundText | OutboundTemplate

export interface SendResult {
  /** ID atribuído pelo provedor (wamid na Cloud API). */
  providerMessageId: string
}

export interface InboundMessage {
  /** ID do provedor — chave de idempotência. */
  providerMessageId: string
  /** Número do remetente em formato E.164 sem "+". */
  from: string
  /** Número que RECEBEU (nosso) — resolve o tenant. */
  phoneNumberId: string
  /** Nome de perfil informado pelo WhatsApp, quando houver. */
  pushName?: string
  /** Epoch em segundos, como o provedor entrega. */
  timestamp: number
  type: string
  /** Texto extraído, quando o tipo tem texto. */
  text: string | null
  /** Payload cru do provedor — sempre gravado, para não perder informação. */
  raw: Record<string, unknown>
}

export interface ChannelAdapter {
  /**
   * Valida a autenticidade do webhook. Deve ser à prova de timing attack e
   * falhar fechado: qualquer dúvida, rejeita.
   */
  verifyWebhook(rawBody: string, signatureHeader: string | null): boolean

  /**
   * Extrai as mensagens recebidas de um payload de webhook já verificado.
   * Um único POST pode carregar várias mensagens e vários números.
   */
  parseInbound(body: unknown): InboundMessage[]

  /** Envia mensagem livre. Só é válido dentro da janela de 24h. */
  send(
    phoneNumberId: string,
    to: string,
    message: OutboundText,
  ): Promise<SendResult>

  /** Envia template aprovado. Único caminho válido fora da janela de 24h. */
  sendTemplate(
    phoneNumberId: string,
    to: string,
    message: OutboundTemplate,
  ): Promise<SendResult>
}
