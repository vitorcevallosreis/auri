import { supabaseServer } from "@/lib/supabase/server"
import { decryptSecret } from "@/lib/crypto/secretBox"
import { CloudApiAdapter } from "./CloudApiAdapter"
import type { ResolvedTenant } from "./persistInbound"

/**
 * Resolução de tenant e construção do adaptador da Cloud API.
 *
 * SERVIDOR APENAS — lê a coluna access_token_encrypted, que o cliente não tem
 * grant para ler (migration 0013).
 */

/**
 * phone_number_id -> tenant. O webhook da Meta identifica o destino só por esse
 * id, então esta é a única porta de entrada do company_id no fluxo. **Nenhum
 * company_id vem de payload** — invariante do Plano 3.
 *
 * Retorna null para número desconhecido; quem chama deve responder 200 mesmo
 * assim (não é erro da Meta, e devolver 4xx só gera reentrega infinita).
 */
export async function resolveTenantByPhoneNumberId(
  phoneNumberId: string,
): Promise<(ResolvedTenant & { assistantId: string | null }) | null> {
  const { data: number, error } = await supabaseServer
    .from("myia_wa_cloud_numbers")
    .select("id, company_id, display_number, status")
    .eq("phone_number_id", phoneNumberId)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Falha ao resolver número: ${error.message}`)
  }

  if (!number) return null

  // O canal liga o número ao assistente que atende. Pode não existir ainda
  // (número conectado mas não vinculado a um agente) — nesse caso gravamos a
  // mensagem na inbox e nenhum agente responde, que é o comportamento certo.
  const { data: channel } = await supabaseServer
    .from("myia_channels")
    .select("id, nome, assistant_id")
    .eq("cloud_number_id", number.id)
    .limit(1)
    .maybeSingle()

  return {
    companyId: number.company_id,
    channelName: channel?.nome || number.display_number || phoneNumberId,
    instanceId: phoneNumberId,
    assistantId: channel?.assistant_id ?? null,
  }
}

/** Token do tenant, decifrado. Lança se o número não estiver conectado. */
export async function resolveAccessToken(
  phoneNumberId: string,
): Promise<string> {
  const { data, error } = await supabaseServer
    .from("myia_wa_cloud_numbers")
    .select("access_token_encrypted")
    .eq("phone_number_id", phoneNumberId)
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Falha ao ler token: ${error.message}`)

  if (!data?.access_token_encrypted) {
    throw new Error(
      `Número ${phoneNumberId} não tem access token — conexão não concluída`,
    )
  }

  return decryptSecret(data.access_token_encrypted)
}

let cached: CloudApiAdapter | null = null

/**
 * Instância compartilhada do adaptador. O App Secret é do app Meta (um só,
 * nosso); o access token é por tenant e resolvido a cada envio.
 */
export function getCloudAdapter(): CloudApiAdapter {
  if (cached) return cached

  const appSecret = process.env.META_APP_SECRET

  if (!appSecret) {
    throw new Error("META_APP_SECRET não configurado")
  }

  cached = new CloudApiAdapter({
    appSecret,
    resolveToken: resolveAccessToken,
  })

  return cached
}
