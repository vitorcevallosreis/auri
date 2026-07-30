import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase/server"
import { enqueueAgentTurn } from "@/lib/agent/enqueue"

// Rota de ingress do Evolution API (Plano 2 — P2.3). Recebe o webhook
// `messages.upsert`, resolve o tenant pela instância e persiste a mensagem
// recebida no Supabase via service role (RLS bypassed no servidor). O Realtime
// (migration 0010) propaga para a inbox do painel. Só texto por ora (mídia é
// fase 2); o payload cru fica gravado em myia_messages.message de todo jeito.
//
// Segurança: header secreto compartilhado (EVOLUTION_WEBHOOK_SECRET) + resolução
// obrigatória da instância em myia_channels. Instância desconhecida => 200 (ack)
// sem gravar, para não sinalizar erro/retentativa ao Evolution.

export const dynamic = "force-dynamic"

interface EvolutionKey {
  remoteJid?: string
  fromMe?: boolean
  id?: string
}

interface EvolutionUpsertData {
  key?: EvolutionKey
  message?: Record<string, any>
  messageType?: string
  messageTimestamp?: number
  pushName?: string
}

interface EvolutionWebhookBody {
  event?: string
  instance?: string
  data?: EvolutionUpsertData
}

function extractText(message?: Record<string, any>): string | null {
  if (!message) return null
  return message.conversation ?? message.extendedTextMessage?.text ?? null
}

export async function POST(req: Request) {
  try {
    // (1) Auth por header secreto compartilhado.
    const expectedSecret = process.env.EVOLUTION_WEBHOOK_SECRET
    if (!expectedSecret) {
      console.error("[whatsapp/ingress] EVOLUTION_WEBHOOK_SECRET não configurado")
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 })
    }
    const providedSecret = req.headers.get("x-auri-webhook-secret")
    if (providedSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await req.json().catch(() => null)) as EvolutionWebhookBody | null
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    // (2) Só tratamos recebimento de mensagens.
    if (body.event !== "messages.upsert") {
      return NextResponse.json({ ok: true, ignored: "event" }, { status: 200 })
    }

    const instance = body.instance
    const data = body.data
    const key = data?.key
    const remoteJid = key?.remoteJid

    if (!instance || !key || !remoteJid) {
      return NextResponse.json({ ok: true, ignored: "malformed" }, { status: 200 })
    }

    // (2b) Ignora eco próprio (fromMe) e grupos (@g.us) — produto é atendimento 1:1.
    if (key.fromMe === true || remoteJid.endsWith("@g.us")) {
      return NextResponse.json({ ok: true, ignored: "fromMe/group" }, { status: 200 })
    }

    // (3) Resolve o tenant: instância -> canal -> assistant -> company_id.
    const { data: channel, error: channelErr } = await supabaseServer
      .from("myia_channels")
      .select('id, assistant_id, nome, "instanceWpp"')
      .eq("instanceWpp", instance)
      .limit(1)
      .maybeSingle()

    if (channelErr) {
      console.error("[whatsapp/ingress] erro ao buscar canal", { instance, channelErr })
      return NextResponse.json({ error: "Channel lookup failed" }, { status: 500 })
    }
    if (!channel) {
      // Instância desconhecida: ack sem gravar (não é erro do Evolution).
      console.warn("[whatsapp/ingress] instância desconhecida, ignorando", { instance })
      return NextResponse.json({ ok: true, ignored: "unknown_instance" }, { status: 200 })
    }

    const { data: assistant, error: assistantErr } = await supabaseServer
      .from("myia_assistants")
      .select("company_id")
      .eq("id", channel.assistant_id)
      .maybeSingle()

    if (assistantErr || !assistant?.company_id) {
      console.error("[whatsapp/ingress] tenant não resolvido", { instance, assistantErr })
      return NextResponse.json({ ok: true, ignored: "no_tenant" }, { status: 200 })
    }
    const companyId = assistant.company_id as string
    const number = remoteJid.split("@")[0]
    const pushName = data?.pushName || number

    // (4) Upsert do contato por (company_id, remote_jid). Sem índice único nessa
    // combinação, então find-or-create.
    let contactId: string | null = null
    const { data: existingContact } = await supabaseServer
      .from("myia_contacts")
      .select("id")
      .eq("company_id", companyId)
      .eq("remote_jid", remoteJid)
      .limit(1)
      .maybeSingle()

    if (existingContact) {
      contactId = existingContact.id
    } else {
      const { data: newContact, error: contactErr } = await supabaseServer
        .from("myia_contacts")
        .insert([{ company_id: companyId, name: pushName, number, remote_jid: remoteJid }])
        .select("id")
        .single()
      if (contactErr) {
        console.error("[whatsapp/ingress] erro ao criar contato", contactErr)
        return NextResponse.json({ error: "Contact upsert failed" }, { status: 500 })
      }
      contactId = newContact.id
    }

    // (5) Upsert do chat por (company_id, instance_id, contact_id). Find-or-create
    // e atualiza last_message/channel_name.
    const text = extractText(data?.message)
    const lastMessage = {
      text,
      from_me: false,
      message_timestamp: data?.messageTimestamp ?? null,
      message_type: data?.messageType ?? null,
    }
    const channelName = channel.nome || instance

    let chatId: string | null = null
    const { data: existingChat } = await supabaseServer
      .from("myia_chat")
      .select("id")
      .eq("company_id", companyId)
      .eq("instance_id", instance)
      .eq("contact_id", contactId)
      .limit(1)
      .maybeSingle()

    if (existingChat) {
      chatId = existingChat.id
      await supabaseServer
        .from("myia_chat")
        .update({ last_message: lastMessage, channel_name: channelName, updated_at: new Date().toISOString() })
        .eq("id", chatId)
    } else {
      const { data: newChat, error: chatErr } = await supabaseServer
        .from("myia_chat")
        .insert([
          {
            company_id: companyId,
            contact_id: contactId,
            instance_id: instance,
            channel_name: channelName,
            last_message: lastMessage,
          },
        ])
        .select("id")
        .single()
      if (chatErr) {
        console.error("[whatsapp/ingress] erro ao criar chat", chatErr)
        return NextResponse.json({ error: "Chat upsert failed" }, { status: 500 })
      }
      chatId = newChat.id
    }

    // (6) Insert idempotente da mensagem. A idempotência é garantida pelo índice
    // único parcial uq_messages_instance_msgid (instance_id, message_id). Como o
    // supabase-js não consegue mirar um índice PARCIAL via `onConflict` (o
    // PostgREST não inclui o predicado `where message_id is not null`), fazemos
    // um insert simples e tratamos a violação de unicidade (código 23505) como
    // no-op — mesmo efeito de `on conflict do nothing`.
    const messageRow = {
      chat_id: chatId,
      from_me: false,
      message_id: key.id,
      key: key,
      message: data?.message ?? null,
      message_type: data?.messageType ?? null,
      message_timestamp: data?.messageTimestamp ?? null,
      instance_id: instance,
      status: "RECEIVED",
    }

    const { error: insertErr } = await supabaseServer.from("myia_messages").insert([messageRow])

    if (insertErr && insertErr.code !== "23505") {
      console.error("[whatsapp/ingress] erro ao inserir mensagem", insertErr)
      return NextResponse.json({ error: "Message insert failed" }, { status: 500 })
    }

    const deduped = insertErr?.code === "23505"

    // (7) Enfileira o turno do agente — Plano 3, Caminho A.
    //
    //     A Cloud API oficial é o destino, mas a habilitação na Meta leva
    //     semanas. Até lá o Evolution serve de ponte com número de TESTE, para
    //     a plataforma atender de verdade. O debounce mora no banco: três
    //     mensagens seguidas empurram o run_after do mesmo job em vez de criar
    //     três turnos.
    //
    //     Só na primeira gravação: numa reentrega (deduped) o turno já foi
    //     enfileirado, e enfileirar de novo só adiaria a resposta ao paciente.
    if (!deduped && channel.assistant_id) {
      await enqueueAgentTurn({
        companyId,
        chatId: chatId as string,
        assistantId: channel.assistant_id as string,
      })
    }

    return NextResponse.json({ ok: true, deduped }, { status: 200 })
  } catch (error) {
    console.error("[whatsapp/ingress] erro inesperado", error)
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/whatsapp/ingress" })
}
