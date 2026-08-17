import { createClient } from "@supabase/supabase-js"
import { supabaseSecretKey, supabaseUrl } from "./keys"

// Precedência para SUPABASE_SECRET_KEY (formato novo), queda para
// SUPABASE_SERVICE_ROLE_KEY (legado) enquanto a migração não termina.
if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error(
    "Credenciais do Supabase para server não encontradas: defina NEXT_PUBLIC_SUPABASE_URL e uma de SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY"
  )
}

// Cliente somente-servidor (schema public). Esta chave IGNORA o RLS — nunca
// deve ser importada por código que roda no navegador.
export const supabaseServer = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  db: {
    schema: "public",
  },
})
