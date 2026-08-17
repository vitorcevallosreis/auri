import { createClient } from "@supabase/supabase-js"

/**
 * Cliente Supabase do worker (service role, ignora RLS).
 *
 * Sim, é quase igual a src/lib/supabase/server.ts — e é de propósito.
 *
 * A primeira versão importava aquele arquivo por caminho relativo para não
 * duplicar. O problema: o package.json não tem `"type": "module"`, então o Node
 * classifica um `.ts` como CommonJS e só consegue carregá-lo reinterpretando
 * como ESM ("Reparsing as ES module... incurs a performance overhead"), e o
 * TypeScript recusa a combinação sob `verbatimModuleSyntax`. O worker passaria
 * a depender de um fallback do runtime para subir.
 *
 * Quinze linhas duplicadas custam menos que esse acoplamento. O que NÃO pode
 * divergir são as opções do client, que ficam idênticas às do app.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

// Mesma precedência de src/lib/supabase/keys.ts: chave nova primeiro, legada
// como queda. Aqui a leitura é direta porque o worker roda em Node puro — não
// há substituição de build para respeitar, ao contrário do bundle do Next.
const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error(
    "Credenciais do Supabase ausentes no worker: defina NEXT_PUBLIC_SUPABASE_URL e uma de SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY",
  )
}

export const supabaseServer = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  db: {
    schema: "public",
  },
})
