import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase/server"

interface TypingBody {
  chat_id: string
  isTyping: boolean
}

export async function POST(req: Request) {
  try {
    const { chat_id, isTyping } = (await req.json()) as TypingBody

    if (!chat_id) {
      return NextResponse.json({ error: "chat_id is required" }, { status: 400 })
    }

    const { data: chat, error: chatErr } = await supabaseServer
      .from("myia_chat")
      .select(
        `id, contact:contact_id (*), channel:channel_id (nome, urlapi, token)`
      )
      .eq("id", chat_id)
      .single()

    if (chatErr || !chat) {
      console.error("[typing] chat lookup failed", { chat_id, chatErr })
      return NextResponse.json({ error: "chat not found" }, { status: 404 })
    }

    const contact = Array.isArray((chat as any).contact)
      ? (chat as any).contact[0]
      : (chat as any).contact
    const channel = Array.isArray((chat as any).channel)
      ? (chat as any).channel[0]
      : (chat as any).channel

    const remoteJid = contact?.remote_jid
      || (contact?.number ? `${contact.number}@s.whatsapp.net` : null)

    if (!remoteJid) {
      return NextResponse.json({ error: "contact remoteJid missing" }, { status: 422 })
    }

    const url = `${channel.urlapi}/chat/sendPresence/${channel.nome}`
    const body = {
      number: remoteJid,
      presence: isTyping ? "composing" : "paused",
      type: "typing",
    }

    // Mask token for logs
    const masked = (t: string) => (t ? `${t.slice(0, 4)}***${t.slice(-3)}` : "")

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: String(channel.token),
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => "")
        console.warn("[typing] provider non-200", {
          status: res.status,
          url,
          apikey: masked(String(channel.token || "")),
          body,
          response: text?.slice(0, 300),
        })
        // Não quebrar UX: retornar 200 mesmo em erro de provider
        return NextResponse.json({ ok: false, status: res.status }, { status: 200 })
      }

      return NextResponse.json({ ok: true }, { status: 200 })
    } catch (err) {
      console.error("[typing] fetch error", err)
      // Não quebrar UX
      return NextResponse.json({ ok: false }, { status: 200 })
    }
  } catch (error) {
    console.error("[typing] error", error)
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
  }
}
