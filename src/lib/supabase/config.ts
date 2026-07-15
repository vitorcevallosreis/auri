import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Credenciais do Supabase não encontradas nas variáveis de ambiente")
}

console.log("Inicializando Supabase com URL:", supabaseUrl);

// Criar o cliente principal do Supabase com schema "nexa"
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
    schema: "nexa",
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

// Configurações globais - tabelas e schemas
export const SUPA_TABLES = {
  table_myia_mensagens: "myia_mensagens",
  table_myia_messages: "myia_messages",
  table_myia_assistants: "myia_assistants",
  table_myia_settings_assistants: "myia_settings_assistants",
  table_myia_settings_company: "myia_settings_company",
  table_myia_settings_personal: "myia_settings_personal",
  table_myia_default_prompts: "myia_default_prompts",
  table_myia_files: "myia_files",
  table_myia_channels: "myia_channels",
}
