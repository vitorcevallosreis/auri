import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase/server"

// Types for request body
interface SendMessageBody {
  chat_id: string
  message_type: "text" | "image" | "audio" | "video" | "document"
  content: any // For text: { text: string }, for media: { name: string, url?: string, mime?: string }
  from_me?: boolean
}

export async function POST(req: Request) {
  try {
    console.log("[api/messages/send] POST reached")
    const body = (await req.json()) as SendMessageBody
    const { chat_id, message_type, content } = body
    console.log("[api/messages/send] payload:", { chat_id, message_type, hasContent: !!content })

    if (!chat_id || !message_type || !content) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    // Map message_type to DB enum values
    const typeMap: Record<SendMessageBody["message_type"], string> = {
      text: "conversation",
      image: "imageMessage",
      audio: "audioMessage",
      video: "videoMessage",
      document: "documentMessage",
    }
    const dbMessageType = typeMap[message_type]

    // Normalizar o content para o formato esperado pelo front (aninhado)
    const alreadyNested =
      content?.audioMessage ||
      content?.imageMessage ||
      content?.documentMessage ||
      content?.videoMessage ||
      content?.conversation ||
      content?.extendedTextMessage

    let normalizedContent: any = content
    if (!alreadyNested) {
      switch (dbMessageType) {
        case "audioMessage":
          normalizedContent = {
            audioMessage: {
              url: content.url || content.mediaUrl || content.fileUrl,
              mimetype: content.mimetype || content.mime,
              seconds: content.seconds,
              ptt: content.ptt ?? true,
            },
          }
          break
        case "imageMessage":
          normalizedContent = {
            imageMessage: {
              url: content.url || content.fileUrl,
              mimetype: content.mimetype || content.mime,
              caption: content.caption || content.fileName || undefined,
            },
          }
          break
        case "documentMessage":
          normalizedContent = {
            documentMessage: {
              url: content.url || content.fileUrl,
              mimetype: content.mimetype || content.mime,
              fileName: content.fileName || undefined,
            },
          }
          break
        case "videoMessage":
          normalizedContent = {
            videoMessage: {
              url: content.url || content.fileUrl,
              mimetype: content.mimetype || content.mime,
              seconds: content.seconds,
            },
          }
          break
        case "conversation":
        default:
          normalizedContent = { conversation: content.conversation || content.text || "" }
          break
      }
    }

    // Fetch channel/contact info securely (service role bypasses RLS)
    const { data: chatData, error: chatErr } = await supabaseServer
      .from("myia_chat")
      .select(
        `id, company_id, channel_id, channel_name, remotejid, contact_id,
         channel:channel_id ( id, nome, urlapi, token, instance_id, remoteJid )`
      )
      .eq("id", chat_id)
      .single()

    if (chatErr || !chatData) {
      console.error("[api/messages/send] chat lookup failed", { chat_id, chatErr })
      // Seguimos sem bloquear o fluxo: ainda inserimos a mensagem e enviamos payload mínimo ao n8n
    }

    // Insert the message with initial status (align with DB enum, e.g., PENDING)
    const messageRow = {
      chat_id,
      from_me: true,
      message_type: dbMessageType,
      status: "PENDING",
      message_timestamp: Math.floor(Date.now() / 1000),
      message: normalizedContent,
    }

    const { data: inserted, error: insertErr } = await supabaseServer
      .from("myia_messages")
      .insert([messageRow])
      .select()
      .single()

    if (insertErr || !inserted) {
      console.error("[api/messages/send] insert error", insertErr)
      return NextResponse.json({ error: "Failed to create message", details: insertErr?.message || insertErr }, { status: 500 })
    }

    // Fire-and-forget call to n8n webhook to send via WhatsApp API
    ;(async () => {
      try {
        const channel = Array.isArray((chatData as any)?.channel)
          ? (chatData as any).channel?.[0]
          : (chatData as any)?.channel
        const remoteJid = (chatData as any)?.remotejid || channel?.remoteJid || null

        const payload = {
          message_row_id: inserted.id,
          chat_id,
          message_type,
          content: normalizedContent,
          channel: channel
            ? {
                id: channel.id,
                nome: channel.nome,
                urlapi: channel.urlapi,
                token: channel.token,
                instance_id: channel.instance_id,
                remoteJid: channel.remoteJid,
              }
            : undefined,
          contact: remoteJid ? { remote_jid: remoteJid } : undefined,
          company_id: (chatData as any)?.company_id,
        }
        await fetch("https://webhooks.sejanexa.com.br/webhook/myia-send-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } catch (err) {
        // Do not throw to avoid impacting client
        console.error("[send-message] n8n call failed", err)
      }
    })()

    return NextResponse.json(
      { success: true, id: inserted.id, status: inserted.status },
      { status: 202 }
    )
  } catch (error) {
    console.error("[send-message] error", error)
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/messages/send" })
}
