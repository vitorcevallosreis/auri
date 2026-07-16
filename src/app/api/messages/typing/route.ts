import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase/server"
import { getAuthedCompanyId } from "@/lib/auth/tenant"

interface TypingBody {
  chat_id: string
  isTyping: boolean
}

export async function POST(req: Request) {
  try {
    // Auth/tenant (rota server-only via service role; middleware não cobre /api/*).
    const callerCompanyId = await getAuthedCompanyId(req)
    if (!callerCompanyId) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
    }

    const { chat_id, isTyping } = (await req.json()) as TypingBody

    if (!chat_id) {
      return NextResponse.json({ error: "chat_id is required" }, { status: 400 })
    }

    // Busca o chat (com company_id p/ ownership e instance_id p/ resolver o canal).
    const { data: chat, error: chatErr } = await supabaseServer
      .from("myia_chat")
      .select(`id, company_id, instance_id, contact:contact_id (*)`)
      .eq("id", chat_id)
      .single()

    if (chatErr || !chat) {
      console.error("[typing] chat lookup failed", { chat_id, chatErr })
      return NextResponse.json({ error: "chat not found" }, { status: 404 })
    }
    // Ownership: o chat tem que ser do tenant do chamador.
    if ((chat as any).company_id !== callerCompanyId) {
      return NextResponse.json({ error: "chat not found" }, { status: 404 })
    }

    // Resolve o canal Evolution por instanceWpp = chat.instance_id (fix do join
    // antigo por channel_id, coluna inexistente em myia_chat).
    const instanceId = (chat as any).instance_id as string | undefined
    const { data: channel } = instanceId
      ? await supabaseServer
          .from("myia_channels")
          .select('nome, urlapi, token, "instanceWpp"')
          .eq("instanceWpp", instanceId)
          .maybeSingle()
      : { data: null as any }

    if (!channel || !channel.urlapi || !channel.token || !channel.instanceWpp) {
      // Sem canal provisionado: não dá pra enviar presença. Não quebra a UX.
      return NextResponse.json({ ok: false, reason: "no_channel" }, { status: 200 })
    }

    const contact = Array.isArray((chat as any).contact)
      ? (chat as any).contact[0]
      : (chat as any).contact

    const remoteJid = contact?.remote_jid
      || (contact?.number ? `${contact.number}@s.whatsapp.net` : null)

    if (!remoteJid) {
      return NextResponse.json({ error: "contact remoteJid missing" }, { status: 422 })
    }

    const url = `${channel.urlapi}/chat/sendPresence/${channel.instanceWpp}`
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
