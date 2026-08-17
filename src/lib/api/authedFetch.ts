import { supabase } from "@/lib/supabase/config"

// Wrapper de `fetch` que anexa o JWT do Supabase como `Authorization: Bearer`.
// Necessário para chamar rotas `/api/*` server-only que autenticam/escopam o
// tenant pelo token (o middleware NÃO protege `/api/*`, e o cookie `authData`
// não é confiável). Mesma assinatura do `fetch`; preserva headers existentes.
export async function authedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const headers = new Headers(init.headers as HeadersInit | undefined)
  if (token) headers.set("Authorization", `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}
