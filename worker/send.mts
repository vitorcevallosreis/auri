import { supabaseServer } from "./supabase.mts"

/**
 * Envio da resposta do agente pelo canal do chat — Plano 3, Caminho A.
 *
 * CONTEXTO DA DECISÃO: o Plano 3 escolheu a Cloud API oficial, mas a habilitação
 * na Meta leva semanas. Para a plataforma atender paciente antes disso, o
 * maestro optou pelo **Caminho A**: usar o gateway Evolution (que já está no ar
 * e testado) como ponte, com número de TESTE.
 *
 * ⚠️ O Evolution viola os ToS do WhatsApp e o número pode ser banido. É ponte,
 * não destino: quando a Meta aprovar, o provider 'cloud' assume e este caminho
 * sai junto com o resto do código do Evolution.
 *
 * O despacho é por `myia_channels.provider`, então os dois convivem sem `if`
 * espalhado pelo turno do agente.
 */

export interface SendResult {
  ok: boolean
  providerMessageId?: string
  error?: string
}

interface Destination {
  provider: string
  /** Número E.164 sem "+", extraído do remote_jid do contato. */
  number: string
  instanceWpp: string | null
  baseUrl: string | null
  apiKey: string | null
}

/**
 * Resolve o canal e o destinatário a partir do chat.
 *
 * Tudo aqui é derivado do `chat_id` que veio do job — nada de identificador
 * vindo do modelo. Mesmo invariante das tools.
 */
async function resolveDestination(
  chatId: string,
  companyId: string,
): Promise<Destination> {
  const { data: chat, error: chatErr } = await supabaseServer
    .from("myia_chat")
    .select("id, company_id, instance_id, contact_id")
    .eq("id", chatId)
    .maybeSingle()

  if (chatErr) throw new Error(`falha ao ler chat: ${chatErr.message}`)
  if (!chat || chat.company_id !== companyId) {
    throw new Error("chat não pertence a esta clínica")
  }
  if (!chat.contact_id) throw new Error("chat sem contato — não há para quem enviar")

  const { data: contact } = await supabaseServer
    .from("myia_contacts")
    .select("remote_jid, number")
    .eq("id", chat.contact_id)
    .eq("company_id", companyId)
    .maybeSingle()

  const jid = contact?.remote_jid ?? null
  const number = jid ? String(jid).split("@")[0] : (contact?.number ?? null)

  if (!number) throw new Error("contato sem número")

  // O canal é encontrado pela instância gravada no chat — mesmo vínculo que o
  // ingress usa na entrada, então entrada e saída não podem divergir.
  const { data: channel } = await supabaseServer
    .from("myia_channels")
    .select('provider, "instanceWpp", token, urlapi')
    .eq("instanceWpp", chat.instance_id)
    .maybeSingle()

  return {
    provider: channel?.provider ?? "evolution",
    number,
    instanceWpp: channel?.instanceWpp ?? chat.instance_id,
    baseUrl: channel?.urlapi ?? process.env.EVOLUTION_API_URL ?? null,
    apiKey: channel?.token ?? process.env.EVOLUTION_API_KEY ?? null,
  }
}

export async function sendTextToChat(
  chatId: string,
  companyId: string,
  text: string,
): Promise<SendResult> {
  let dest: Destination

  try {
    dest = await resolveDestination(chatId, companyId)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }

  if (dest.provider === "cloud") {
    // A Cloud API tem envio próprio (CloudApiAdapter), mas ele nunca rodou
    // contra a Meta. Falhar explícito é melhor que fingir que enviou: a
    // mensagem fica PENDING na inbox e um humano vê.
    return {
      ok: false,
      error: "canal 'cloud' ainda não validado contra a Meta — envio não realizado",
    }
  }

  if (!dest.baseUrl || !dest.apiKey || !dest.instanceWpp) {
    return { ok: false, error: "configuração do canal Evolution incompleta" }
  }

  try {
    const url = `${dest.baseUrl.replace(/\/$/, "")}/message/sendText/${dest.instanceWpp}`

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: dest.apiKey },
      body: JSON.stringify({ number: dest.number, text }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      return {
        ok: false,
        error: `Evolution respondeu ${response.status}: ${body.slice(0, 200)}`,
      }
    }

    const json = (await response.json().catch(() => null)) as
      | { key?: { id?: string } }
      | null

    return { ok: true, providerMessageId: json?.key?.id }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
