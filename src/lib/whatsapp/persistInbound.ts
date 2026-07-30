import { supabaseServer } from "@/lib/supabase/server"
import type { InboundMessage } from "./ChannelAdapter"

/**
 * Persistência de mensagem recebida: contato -> chat -> mensagem.
 *
 * Extraído do ingress do Evolution (Plano 2) para não duplicar a lógica no
 * webhook da Cloud API. Roda com service role, então a RLS está bypassada — o
 * `company_id` usado aqui vem SEMPRE da resolução do canal pelo servidor, nunca
 * de conteúdo do payload.
 */

export interface ResolvedTenant {
  companyId: string
  /** Nome do canal, usado como rótulo na inbox. */
  channelName: string
  /**
   * Agrupador do chat. Na Cloud API é o phone_number_id — também é o que faz o
   * índice uq_messages_instance_msgid (instance_id, message_id) da migration
   * 0011 valer como idempotência aqui.
   */
  instanceId: string
}

export interface PersistResult {
  chatId: string
  contactId: string
  /** false quando a mensagem já existia (reentrega do provedor). */
  inserted: boolean
}

export async function persistInboundMessage(
  msg: InboundMessage,
  tenant: ResolvedTenant,
): Promise<PersistResult> {
  const { companyId, channelName, instanceId } = tenant

  // A Cloud API entrega o número puro (E.164 sem "+"); o resto do schema fala
  // remote_jid no formato do WhatsApp. Normalizamos para manter a inbox, os
  // contatos e o histórico do Evolution com a mesma forma.
  const remoteJid = `${msg.from}@s.whatsapp.net`
  const displayName = msg.pushName?.trim() || msg.from

  // ---- contato: find-or-create por (company_id, remote_jid) ----------------
  // Sem índice único nessa combinação no schema atual, então find-or-create.
  const contactId = await findOrCreateContact({
    companyId,
    remoteJid,
    number: msg.from,
    name: displayName,
  })

  // ---- chat: find-or-create por (company_id, instance_id, contact_id) ------
  const lastMessage = {
    text: msg.text,
    from_me: false,
    message_timestamp: msg.timestamp,
    message_type: msg.type,
  }

  const chatId = await findOrCreateChat({
    companyId,
    contactId,
    instanceId,
    channelName,
    lastMessage,
  })

  // ---- mensagem: insert idempotente ---------------------------------------
  // A idempotência vem do índice único PARCIAL uq_messages_instance_msgid. O
  // supabase-js não consegue mirar índice parcial via onConflict (o PostgREST
  // não carrega o predicado `where message_id is not null`), então inserimos
  // direto e tratamos 23505 como no-op — mesmo efeito de `on conflict do
  // nothing`. Mesma abordagem do ingress do Evolution.
  const { error: msgErr } = await supabaseServer.from("myia_messages").insert([
    {
      chat_id: chatId,
      from_me: false,
      message_id: msg.providerMessageId,
      key: { id: msg.providerMessageId, remoteJid, fromMe: false },
      message: msg.raw,
      message_type: msg.type,
      message_timestamp: msg.timestamp,
      instance_id: instanceId,
      status: "RECEIVED",
    },
  ])

  if (msgErr) {
    if (msgErr.code === "23505") {
      // Reentrega da Meta. Esperado, não é erro.
      return { chatId, contactId, inserted: false }
    }
    throw new Error(`Falha ao gravar mensagem: ${msgErr.message}`)
  }

  return { chatId, contactId, inserted: true }
}

async function findOrCreateContact(args: {
  companyId: string
  remoteJid: string
  number: string
  name: string
}): Promise<string> {
  const { data: existing } = await supabaseServer
    .from("myia_contacts")
    .select("id")
    .eq("company_id", args.companyId)
    .eq("remote_jid", args.remoteJid)
    .limit(1)
    .maybeSingle()

  if (existing) return existing.id

  const { data: created, error } = await supabaseServer
    .from("myia_contacts")
    .insert([
      {
        company_id: args.companyId,
        name: args.name,
        number: args.number,
        remote_jid: args.remoteJid,
      },
    ])
    .select("id")
    .single()

  if (error) throw new Error(`Falha ao criar contato: ${error.message}`)

  return created.id
}

async function findOrCreateChat(args: {
  companyId: string
  contactId: string
  instanceId: string
  channelName: string
  lastMessage: Record<string, unknown>
}): Promise<string> {
  const { data: existing } = await supabaseServer
    .from("myia_chat")
    .select("id")
    .eq("company_id", args.companyId)
    .eq("instance_id", args.instanceId)
    .eq("contact_id", args.contactId)
    .limit(1)
    .maybeSingle()

  if (existing) {
    await supabaseServer
      .from("myia_chat")
      .update({
        last_message: args.lastMessage,
        channel_name: args.channelName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)

    return existing.id
  }

  const { data: created, error } = await supabaseServer
    .from("myia_chat")
    .insert([
      {
        company_id: args.companyId,
        contact_id: args.contactId,
        instance_id: args.instanceId,
        channel_name: args.channelName,
        last_message: args.lastMessage,
      },
    ])
    .select("id")
    .single()

  if (error) throw new Error(`Falha ao criar chat: ${error.message}`)

  return created.id
}
