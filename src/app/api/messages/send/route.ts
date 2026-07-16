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

    // Buscar o chat + contato (service role bypassa RLS). NOTA: o schema novo
    // (migration 0003) NÃO tem `channel_id`/`remotejid` em myia_chat — tem
    // `instance_id` (nome da instância Evolution) e `contact_id`. Resolvemos o
    // canal por instanceWpp = chat.instance_id e o destinatário via o contato.
    const { data: chatData, error: chatErr } = await supabaseServer
      .from("myia_chat")
      .select(
        `id, company_id, instance_id, channel_name, contact_id,
         contact:contact_id ( remote_jid, number )`
      )
      .eq("id", chat_id)
      .single()

    if (chatErr || !chatData) {
      console.error("[api/messages/send] chat lookup failed", { chat_id, chatErr })
      // Seguimos sem bloquear: ainda inserimos a mensagem (status refletirá a falha de envio).
    }

    // Resolver o canal Evolution do chat (bugfix P2.4: antes fazia join por
    // channel_id inexistente e retornava null).
    let channel:
      | { id: string; nome: string | null; urlapi: string | null; token: string | null; instanceWpp: string | null; remoteJid: string | null }
      | null = null
    const instanceId = (chatData as any)?.instance_id as string | undefined
    if (instanceId) {
      const { data: ch, error: chErr } = await supabaseServer
        .from("myia_channels")
        .select('id, nome, urlapi, token, "instanceWpp", "remoteJid"')
        .eq("instanceWpp", instanceId)
        .maybeSingle()
      if (chErr) console.error("[api/messages/send] channel lookup failed", { instanceId, chErr })
      channel = (ch as any) ?? null
    }

    // Insert the message with initial status PENDING
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

    // Mídia (image/audio/video/document): fora do escopo do P2.4. Guardamos a
    // mensagem com status PENDING e NÃO chamamos o Evolution ainda.
    // TODO fase 2: sendMedia (POST {urlapi}/message/sendMedia/{instance}) — depende
    // da decisão de storage (MinIO vs Supabase Storage).
    if (message_type !== "text") {
      return NextResponse.json(
        { success: true, id: inserted.id, status: inserted.status, note: "media pending (fase 2)" },
        { status: 202 }
      )
    }

    // Texto: envio DIRETO ao Evolution API (substitui o antigo webhook n8n).
    const contactRel = (chatData as any)?.contact
    const contact = Array.isArray(contactRel) ? contactRel[0] : contactRel
    const recipientJid: string | null = contact?.remote_jid || channel?.remoteJid || null
    const number = recipientJid ? String(recipientJid).split("@")[0] : null
    const text: string = normalizedContent?.conversation || content?.text || ""
    const baseUrl = channel?.urlapi || process.env.EVOLUTION_API_URL
    const apikey = channel?.token

    // Fire-and-forget: envia ao Evolution e atualiza o status (SENT/FAILED).
    ;(async () => {
      let newStatus = "FAILED"
      try {
        if (!channel || !baseUrl || !apikey || !channel.instanceWpp || !number) {
          console.error("[api/messages/send] envio abortado: config de canal/destinatário incompleta", {
            hasChannel: !!channel,
            hasBaseUrl: !!baseUrl,
            hasApiKey: !!apikey,
            instanceWpp: channel?.instanceWpp,
            number,
          })
        } else {
          const url = `${baseUrl.replace(/\/$/, "")}/message/sendText/${channel.instanceWpp}`
          const resp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey },
            body: JSON.stringify({ number, text }),
          })
          if (resp.ok) {
            newStatus = "SENT"
          } else {
            const errBody = await resp.text().catch(() => "")
            console.error("[api/messages/send] Evolution respondeu erro", { status: resp.status, errBody })
          }
        }
      } catch (err) {
        console.error("[api/messages/send] falha ao chamar Evolution", err)
      }
      const { error: updErr } = await supabaseServer
        .from("myia_messages")
        .update({ status: newStatus })
        .eq("id", inserted.id)
      if (updErr) console.error("[api/messages/send] falha ao atualizar status", updErr)
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
