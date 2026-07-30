import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase/server"
import { getAuthedCompanyId } from "@/lib/auth/tenant"
import { encryptSecret } from "@/lib/crypto/secretBox"

/**
 * Callback do Embedded Signup — Plano 3, P3.1.
 *
 * Substitui o pareamento por QR code do Evolution. O fluxo do lado do cliente
 * abre o popup da Meta (JS SDK), a clínica autoriza, e o popup devolve um
 * `code` de curta duração. Esta rota troca esse code pelo access token do
 * tenant, descobre WABA e número, inscreve nosso app nos webhooks daquele WABA
 * e grava tudo — com o token cifrado.
 *
 * Segurança: o middleware EXCLUI /api/*, então esta rota autentica o chamador
 * ela mesma via Bearer JWT do Supabase (mesmo padrão do Plano 2). O
 * `company_id` vem do JWT — nunca do corpo da requisição, senão qualquer
 * usuário logado conectaria um número na empresa de outro.
 */

export const dynamic = "force-dynamic"

const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v21.0"
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

export async function POST(req: Request) {
  // (1) Quem está chamando, e de qual empresa.
  const companyId = await getAuthedCompanyId(req)

  if (!companyId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET

  if (!appId || !appSecret) {
    console.error("[wa/cloud/signup] META_APP_ID/META_APP_SECRET ausentes")
    return NextResponse.json({ error: "not_configured" }, { status: 500 })
  }

  const body = (await req.json().catch(() => null)) as {
    code?: string
    assistant_id?: string
  } | null

  if (!body?.code) {
    return NextResponse.json({ error: "missing_code" }, { status: 400 })
  }

  try {
    // (2) code -> access token do tenant.
    const token = await exchangeCode(body.code, appId, appSecret)

    // (3) Descobre o WABA autorizado e o número dentro dele.
    const wabaId = await resolveWabaId(token, appId, appSecret)
    const phone = await resolvePhoneNumber(token, wabaId)

    // (4) Inscreve nosso app nos webhooks deste WABA. Sem isso, o número é
    //     autorizado mas nenhuma mensagem chega no nosso webhook.
    await subscribeApp(token, wabaId)

    // (5) Grava. Upsert por phone_number_id (índice único da migration 0013):
    //     reconectar o mesmo número atualiza o token em vez de duplicar linha.
    const { data: saved, error } = await supabaseServer
      .from("myia_wa_cloud_numbers")
      .upsert(
        {
          company_id: companyId,
          waba_id: wabaId,
          phone_number_id: phone.id,
          display_number: phone.display_phone_number ?? null,
          verified_name: phone.verified_name ?? null,
          quality_rating: phone.quality_rating ?? null,
          access_token_encrypted: encryptSecret(token),
          token_updated_at: new Date().toISOString(),
          status: "connected",
          verified_at: new Date().toISOString(),
        },
        { onConflict: "phone_number_id" },
      )
      .select("id, phone_number_id, display_number, verified_name, status")
      .single()

    if (error) {
      throw new Error(`Falha ao gravar número: ${error.message}`)
    }

    // (6) Vincula ao assistente, se veio um. Confere que o assistente é da
    //     MESMA empresa do chamador — sem isso dá para sequestrar o canal de
    //     outro tenant passando um assistant_id qualquer.
    if (body.assistant_id) {
      const { data: assistant } = await supabaseServer
        .from("myia_assistants")
        .select("id, company_id")
        .eq("id", body.assistant_id)
        .maybeSingle()

      if (!assistant || assistant.company_id !== companyId) {
        return NextResponse.json(
          { error: "assistant_not_found" },
          { status: 404 },
        )
      }

      await supabaseServer.from("myia_channels").upsert(
        {
          assistant_id: body.assistant_id,
          provider: "cloud",
          cloud_number_id: saved.id,
          nome: phone.verified_name ?? phone.display_phone_number ?? "WhatsApp",
          numeroTel: phone.display_phone_number ?? null,
          status: "open",
        },
        { onConflict: "cloud_number_id" },
      )
    }

    // Nunca devolver o token — nem para o dono.
    return NextResponse.json({ ok: true, number: saved })
  } catch (error) {
    console.error("[wa/cloud/signup] falha na conexão:", error)
    return NextResponse.json(
      {
        error: "signup_failed",
        detail: error instanceof Error ? error.message : "erro inesperado",
      },
      { status: 502 },
    )
  }
}

// ---------------------------------------------------------------------------
// Graph API
// ---------------------------------------------------------------------------

async function exchangeCode(
  code: string,
  appId: string,
  appSecret: string,
): Promise<string> {
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`)
  url.searchParams.set("client_id", appId)
  url.searchParams.set("client_secret", appSecret)
  url.searchParams.set("code", code)

  const res = await fetch(url, { method: "GET" })
  const json = (await res.json().catch(() => null)) as {
    access_token?: string
    error?: { message?: string }
  } | null

  if (!res.ok || !json?.access_token) {
    throw new Error(
      json?.error?.message ?? `Troca de code falhou (${res.status})`,
    )
  }

  return json.access_token
}

/**
 * O WABA autorizado sai do debug_token: `granular_scopes` traz os IDs por
 * escopo. Preferimos isso a pedir o WABA no corpo da requisição — o cliente não
 * deve escolher a qual conta o token pertence.
 */
async function resolveWabaId(
  token: string,
  appId: string,
  appSecret: string,
): Promise<string> {
  const url = new URL(`${GRAPH_BASE}/debug_token`)
  url.searchParams.set("input_token", token)
  url.searchParams.set("access_token", `${appId}|${appSecret}`)

  const res = await fetch(url)
  const json = (await res.json().catch(() => null)) as {
    data?: {
      granular_scopes?: Array<{ scope?: string; target_ids?: string[] }>
    }
    error?: { message?: string }
  } | null

  if (!res.ok) {
    throw new Error(json?.error?.message ?? `debug_token falhou (${res.status})`)
  }

  const scopes = json?.data?.granular_scopes ?? []
  const management = scopes.find(
    (s) => s.scope === "whatsapp_business_management",
  )
  const messaging = scopes.find(
    (s) => s.scope === "whatsapp_business_messaging",
  )

  const wabaId =
    management?.target_ids?.[0] ?? messaging?.target_ids?.[0] ?? null

  if (!wabaId) {
    throw new Error(
      "Nenhum WhatsApp Business Account no token — a autorização não concedeu os escopos esperados",
    )
  }

  return wabaId
}

interface PhoneNumber {
  id: string
  display_phone_number?: string
  verified_name?: string
  quality_rating?: string
}

async function resolvePhoneNumber(
  token: string,
  wabaId: string,
): Promise<PhoneNumber> {
  const res = await fetch(
    `${GRAPH_BASE}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating`,
    { headers: { Authorization: `Bearer ${token}` } },
  )

  const json = (await res.json().catch(() => null)) as {
    data?: PhoneNumber[]
    error?: { message?: string }
  } | null

  if (!res.ok) {
    throw new Error(
      json?.error?.message ?? `Listagem de números falhou (${res.status})`,
    )
  }

  const first = json?.data?.[0]

  if (!first?.id) {
    throw new Error("WABA autorizado não tem número de telefone")
  }

  // Um WABA pode ter vários números; hoje conectamos o primeiro. Suporte a
  // múltiplos números por clínica fica para quando houver demanda real — o
  // schema já aguenta (uma linha por phone_number_id).
  return first
}

async function subscribeApp(token: string, wabaId: string): Promise<void> {
  const res = await fetch(`${GRAPH_BASE}/${wabaId}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as {
      error?: { message?: string }
    } | null
    throw new Error(
      json?.error?.message ?? `subscribed_apps falhou (${res.status})`,
    )
  }
}
