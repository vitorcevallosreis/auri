import { createClient } from "@supabase/supabase-js"
import { supabasePublishableKey, supabaseUrl } from "./keys"

// A chave vem de ./keys, que dá precedência ao formato novo
// (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) e cai para o legado
// (NEXT_PUBLIC_SUPABASE_ANON_KEY) enquanto a migração não termina.
const supabaseAnonKey = supabasePublishableKey

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Credenciais do Supabase não encontradas: defina NEXT_PUBLIC_SUPABASE_URL e uma de NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY"
  )
}

console.log("Inicializando Supabase com URL:", supabaseUrl);

// Cliente principal do Supabase (schema public)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
  },
  db: {
    schema: "public",
  },
})

// Criar cliente para storage
export const supabase_storage = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      "Accept": "application/json",
    },
  },
})
