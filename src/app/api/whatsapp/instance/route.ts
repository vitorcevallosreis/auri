import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase/server"

// Rota server-only de gestão de instância do Evolution API (Plano 2 — P2.5).
// Substitui o antigo webhook n8n `gerenciar-channel`. Toda a orquestração da
// instância (criar/conectar/desconectar/excluir) acontece aqui, no servidor,
// usando a API KEY GLOBAL do Evolution (EVOLUTION_API_KEY) — que NUNCA é exposta
// ao browser. A persistência em myia_channels usa o service role (bypass RLS).
//
// Contrato: POST { action: 'create'|'connect'|'logout'|'delete', ... }.
//  - create : { assistantId, nome, apiType? }  -> cria a linha do canal, cria a
//             instância no Evolution (com webhook de ingress embutido) e grava
//             token/instanceWpp/urlapi/qrcode64/status. Retorna { channel }.
//  - connect: { channelId } -> GET /instance/connect/{i}; atualiza qrcode64/
//             pairing_code/status.
//  - logout : { channelId } -> DELETE /instance/logout/{i}; status='close'.
//  - delete : { channelId } -> DELETE /instance/delete/{i}; remove a linha.

export const dynamic = "force-dynamic"

type Action = "create" | "connect" | "logout" | "delete"

interface InstanceRequestBody {
  action?: Action
  channelId?: string
  assistantId?: string
  nome?: string
  apiType?: "Evolution" | "Waha"
}

interface ChannelRow {
  id: string
  assistant_id: string
  nome: string | null
  status: string | null
  token: string | null
  urlapi: string | null
  qrcode64: string | null
  pairing_code: string | null
  instanceWpp: string | null
  remoteJid: string | null
}

const CHANNEL_COLS =
  'id, assistant_id, nome, status, token, urlapi, qrcode64, pairing_code, "instanceWpp", "remoteJid"'

function trimSlash(url: string): string {
  return url.replace(/\/$/, "")
}

// instanceWpp determinístico e único a partir do id da linha do canal.
function instanceNameFromChannelId(channelId: string): string {
  return "auri_" + channelId.replace(/-/g, "")
}

function envConfig() {
  const baseUrl = process.env.EVOLUTION_API_URL
  const globalKey = process.env.EVOLUTION_API_KEY
  const webhookSecret = process.env.EVOLUTION_WEBHOOK_SECRET
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  return { baseUrl, globalKey, webhookSecret, appUrl }
}

async function fetchChannel(channelId: string): Promise<ChannelRow | null> {
  const { data, error } = await supabaseServer
    .from("myia_channels")
    .select(CHANNEL_COLS)
    .eq("id", channelId)
    .maybeSingle()
  if (error) {
    console.error("[whatsapp/instance] erro ao buscar canal", { channelId, error })
    return null
  }
  return (data as ChannelRow) ?? null
}

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------
async function handleCreate(body: InstanceRequestBody) {
  const { baseUrl, globalKey, webhookSecret, appUrl } = envConfig()
  if (!baseUrl || !globalKey) {
    return NextResponse.json(
      { ok: false, error: "Evolution não configurado (EVOLUTION_API_URL/EVOLUTION_API_KEY)." },
      { status: 500 }
    )
  }
  if (!body.assistantId || !body.nome) {
    return NextResponse.json({ ok: false, error: "assistantId e nome são obrigatórios." }, { status: 400 })
  }

  // (1) Cria a linha do canal primeiro — precisamos do id para nomear a instância.
  const { data: created, error: createErr } = await supabaseServer
    .from("myia_channels")
    .insert([
      {
        assistant_id: body.assistantId,
        nome: body.nome,
        apiUtilizada: body.apiType || "Evolution",
        status: "created",
      },
    ])
    .select(CHANNEL_COLS)
    .single()

  if (createErr || !created) {
    console.error("[whatsapp/instance] erro ao criar linha do canal", createErr)
    return NextResponse.json({ ok: false, error: "Falha ao criar canal no banco." }, { status: 500 })
  }

  const channel = created as ChannelRow
  const instanceName = instanceNameFromChannelId(channel.id)

  // (2) Cria a instância no Evolution com o webhook de ingress embutido.
  const webhookUrl = appUrl ? `${trimSlash(appUrl)}/api/whatsapp/ingress` : undefined
  const createPayload: Record<string, any> = {
    instanceName,
    integration: "WHATSAPP-BAILEYS",
    qrcode: true,
  }
  if (webhookUrl) {
    createPayload.webhook = {
      url: webhookUrl,
      byEvents: false,
      base64: false,
      headers: { "X-Auri-Webhook-Secret": webhookSecret },
      events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED", "SEND_MESSAGE"],
    }
  } else {
    console.warn("[whatsapp/instance] NEXT_PUBLIC_APP_URL ausente: instância criada sem webhook de ingress")
  }

  let hash: string | null = null
  let qrcode64: string | null = null
  let evoError: string | null = null
  try {
    const resp = await fetch(`${trimSlash(baseUrl)}/instance/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: globalKey },
      body: JSON.stringify(createPayload),
    })
    const respJson = (await resp.json().catch(() => null)) as any
    if (!resp.ok) {
      evoError = `Evolution /instance/create respondeu ${resp.status}: ${JSON.stringify(respJson)}`
      console.error("[whatsapp/instance]", evoError)
    } else {
      hash = respJson?.hash ?? respJson?.instance?.hash ?? null
      qrcode64 = respJson?.qrcode?.base64 ?? null
    }
  } catch (err) {
    evoError = `Falha ao chamar Evolution: ${String(err)}`
    console.error("[whatsapp/instance]", evoError)
  }

  // (3) Persiste o que temos (mesmo com falha parcial do Evolution, guardamos o
  // instanceWpp/urlapi para permitir reconectar depois via connect).
  const { data: updated, error: updErr } = await supabaseServer
    .from("myia_channels")
    .update({
      instanceWpp: instanceName,
      token: hash,
      urlapi: baseUrl,
      qrcode64: qrcode64,
      status: "created",
    })
    .eq("id", channel.id)
    .select(CHANNEL_COLS)
    .single()

  if (updErr) {
    console.error("[whatsapp/instance] erro ao atualizar canal pós-create", updErr)
  }

  const finalChannel = (updated as ChannelRow) ?? channel
  return NextResponse.json(
    {
      ok: !evoError,
      channel: finalChannel,
      qrcode64,
      status: finalChannel.status,
      error: evoError,
    },
    { status: evoError ? 502 : 200 }
  )
}

// ---------------------------------------------------------------------------
// connect (gera/renova QR ou pairing code)
// ---------------------------------------------------------------------------
async function handleConnect(body: InstanceRequestBody) {
  if (!body.channelId) {
    return NextResponse.json({ ok: false, error: "channelId é obrigatório." }, { status: 400 })
  }
  const channel = await fetchChannel(body.channelId)
  if (!channel) {
    return NextResponse.json({ ok: false, error: "Canal não encontrado." }, { status: 404 })
  }
  const baseUrl = channel.urlapi || process.env.EVOLUTION_API_URL
  const apikey = channel.token || process.env.EVOLUTION_API_KEY
  if (!baseUrl || !apikey || !channel.instanceWpp) {
    return NextResponse.json(
      { ok: false, error: "Canal sem instância provisionada (urlapi/token/instanceWpp)." },
      { status: 409 }
    )
  }

  let qrcode64: string | null = null
  let pairingCode: string | null = null
  let evoError: string | null = null
  try {
    const resp = await fetch(`${trimSlash(baseUrl)}/instance/connect/${channel.instanceWpp}`, {
      method: "GET",
      headers: { apikey },
    })
    const respJson = (await resp.json().catch(() => null)) as any
    if (!resp.ok) {
      evoError = `Evolution /instance/connect respondeu ${resp.status}: ${JSON.stringify(respJson)}`
      console.error("[whatsapp/instance]", evoError)
    } else {
      qrcode64 = respJson?.base64 ?? respJson?.qrcode?.base64 ?? null
      pairingCode = respJson?.pairingCode ?? respJson?.code ?? null
    }
  } catch (err) {
    evoError = `Falha ao chamar Evolution: ${String(err)}`
    console.error("[whatsapp/instance]", evoError)
  }

  const { data: updated } = await supabaseServer
    .from("myia_channels")
    .update({ qrcode64, pairing_code: pairingCode, status: "created" })
    .eq("id", channel.id)
    .select(CHANNEL_COLS)
    .single()

  return NextResponse.json(
    {
      ok: !evoError,
      channel: (updated as ChannelRow) ?? channel,
      qrcode64,
      pairing_code: pairingCode,
      status: "created",
      error: evoError,
    },
    { status: evoError ? 502 : 200 }
  )
}

// ---------------------------------------------------------------------------
// logout (desconecta o número, mantém a instância)
// ---------------------------------------------------------------------------
async function handleLogout(body: InstanceRequestBody) {
  if (!body.channelId) {
    return NextResponse.json({ ok: false, error: "channelId é obrigatório." }, { status: 400 })
  }
  const channel = await fetchChannel(body.channelId)
  if (!channel) {
    return NextResponse.json({ ok: false, error: "Canal não encontrado." }, { status: 404 })
  }
  const baseUrl = channel.urlapi || process.env.EVOLUTION_API_URL
  const apikey = channel.token || process.env.EVOLUTION_API_KEY

  let evoError: string | null = null
  if (baseUrl && apikey && channel.instanceWpp) {
    try {
      const resp = await fetch(`${trimSlash(baseUrl)}/instance/logout/${channel.instanceWpp}`, {
        method: "DELETE",
        headers: { apikey },
      })
      if (!resp.ok) {
        const t = await resp.text().catch(() => "")
        evoError = `Evolution /instance/logout respondeu ${resp.status}: ${t}`
        console.error("[whatsapp/instance]", evoError)
      }
    } catch (err) {
      evoError = `Falha ao chamar Evolution: ${String(err)}`
      console.error("[whatsapp/instance]", evoError)
    }
  }

  // Independentemente do Evolution, refletimos o estado desconectado localmente.
  const { data: updated } = await supabaseServer
    .from("myia_channels")
    .update({ status: "close", qrcode64: null, pairing_code: null })
    .eq("id", channel.id)
    .select(CHANNEL_COLS)
    .single()

  return NextResponse.json(
    { ok: !evoError, channel: (updated as ChannelRow) ?? channel, status: "close", error: evoError },
    { status: 200 }
  )
}

// ---------------------------------------------------------------------------
// delete (remove a instância no Evolution e a linha do canal)
// ---------------------------------------------------------------------------
async function handleDelete(body: InstanceRequestBody) {
  if (!body.channelId) {
    return NextResponse.json({ ok: false, error: "channelId é obrigatório." }, { status: 400 })
  }
  const channel = await fetchChannel(body.channelId)
  if (!channel) {
    // Já não existe: idempotente.
    return NextResponse.json({ ok: true, deleted: true }, { status: 200 })
  }
  const baseUrl = channel.urlapi || process.env.EVOLUTION_API_URL
  const apikey = channel.token || process.env.EVOLUTION_API_KEY

  let evoWarn: string | null = null
  if (baseUrl && apikey && channel.instanceWpp) {
    try {
      const resp = await fetch(`${trimSlash(baseUrl)}/instance/delete/${channel.instanceWpp}`, {
        method: "DELETE",
        headers: { apikey },
      })
      if (!resp.ok) {
        const t = await resp.text().catch(() => "")
        evoWarn = `Evolution /instance/delete respondeu ${resp.status}: ${t}`
        console.warn("[whatsapp/instance]", evoWarn)
      }
    } catch (err) {
      evoWarn = `Falha ao chamar Evolution no delete: ${String(err)}`
      console.warn("[whatsapp/instance]", evoWarn)
    }
  }

  // Remove a linha do canal (UX de "Excluir canal"). Falha no Evolution não
  // bloqueia a remoção local — a instância órfã, se houver, é limpável no VPS.
  const { error: delErr } = await supabaseServer.from("myia_channels").delete().eq("id", channel.id)
  if (delErr) {
    console.error("[whatsapp/instance] erro ao remover linha do canal", delErr)
    return NextResponse.json({ ok: false, error: "Falha ao excluir canal no banco." }, { status: 500 })
  }

  return NextResponse.json({ ok: true, deleted: true, warning: evoWarn }, { status: 200 })
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as InstanceRequestBody | null
    if (!body || !body.action) {
      return NextResponse.json({ ok: false, error: "action é obrigatório." }, { status: 400 })
    }

    switch (body.action) {
      case "create":
        return await handleCreate(body)
      case "connect":
        return await handleConnect(body)
      case "logout":
        return await handleLogout(body)
      case "delete":
        return await handleDelete(body)
      default:
        return NextResponse.json({ ok: false, error: `action inválida: ${body.action}` }, { status: 400 })
    }
  } catch (error) {
    console.error("[whatsapp/instance] erro inesperado", error)
    return NextResponse.json({ ok: false, error: "Unexpected error" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/whatsapp/instance" })
}
