import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Credenciais do Supabase não encontradas nas variáveis de ambiente")
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
