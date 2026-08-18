import { supabaseServer } from "@/lib/supabase/server"

// Guard de autenticação/tenant para route handlers server-only que operam via
// service role (bypass RLS). Como o middleware EXCLUI `/api/*` e o cookie
// `authData` é httpOnly:false e não-assinado, a identidade do chamador NÃO pode
// vir do cookie — vem do JWT do Supabase enviado em `Authorization: Bearer`.
//
// Fluxo: valida o JWT via GoTrue (`auth.getUser`), resolve o `company_id` do
// chamador em `myia_users` e permite comparar com o dono do recurso alvo.

/** Resolve o company_id do chamador a partir do Bearer JWT; null se inválido/ausente. */
export async function getAuthedCompanyId(req: Request): Promise<string | null> {
  const authz = req.headers.get("authorization") || ""
  const token = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7).trim() : ""
  if (!token) return null

  // Valida o JWT contra o Auth do Supabase (não confia no payload sem verificar).
  const { data, error } = await supabaseServer.auth.getUser(token)
  if (error || !data?.user) return null

  const { data: userRow, error: userErr } = await supabaseServer
    .from("myia_users")
    .select("company_id")
    .eq("id", data.user.id)
    .maybeSingle()
  if (userErr || !userRow?.company_id) return null
  return userRow.company_id as string
}

/** company_id dono de um chat (via myia_chat); null se não existir. */
export async function chatCompanyId(chatId: string): Promise<string | null> {
  const { data } = await supabaseServer
    .from("myia_chat")
    .select("company_id")
    .eq("id", chatId)
    .maybeSingle()
  return (data?.company_id as string) ?? null
}

/** company_id dono de um assistant (via myia_assistants); null se não existir. */
export async function assistantCompanyId(assistantId: string): Promise<string | null> {
  const { data } = await supabaseServer
    .from("myia_assistants")
    .select("company_id")
    .eq("id", assistantId)
    .maybeSingle()
  return (data?.company_id as string) ?? null
}
