/**
 * Resolução das chaves de API do Supabase, num lugar só.
 *
 * O Supabase tem dois sistemas de chave em paralelo:
 *
 *   legado   anon (público)          service_role (secreto)   — JWTs, `eyJ...`
 *   novo     sb_publishable_...      sb_secret_...
 *
 * As legadas serão descontinuadas até o fim de 2026, e têm um problema
 * estrutural: rotacioná-las exige regenerar o JWT SECRET do projeto, o que
 * reassina tudo e DERRUBA TODAS AS SESSÕES de usuário. As novas são
 * independentes do JWT secret — dá para criar, trocar e revogar uma chave sem
 * deslogar ninguém.
 *
 * ESTRATÉGIA DE TRANSIÇÃO: o novo nome tem precedência, o antigo é a queda.
 * Isso permite que o código suba ANTES de as chaves novas existirem (usando as
 * legadas) e passe a usar as novas assim que elas aparecerem no ambiente, sem
 * um segundo deploy e sem janela em que nada funciona.
 *
 * POR QUE OS `process.env.X` ESTÃO ESCRITOS LITERALMENTE, e não num laço sobre
 * uma lista de nomes: o Next substitui `process.env.NEXT_PUBLIC_*` por texto no
 * momento do build. A substituição só acontece na forma literal — qualquer
 * indireção (`process.env[nome]`) resulta em `undefined` no bundle do
 * navegador, silenciosamente.
 *
 * DIFERENÇA DE HEADER, para quem for escrever `fetch` cru: chave nova NÃO pode
 * ir em `Authorization: Bearer`, só em `apikey` (a exceção é quando os dois
 * headers carregam exatamente o mesmo valor, que é o que o supabase-js faz).
 * JWT de usuário continua no `Authorization: Bearer` normalmente.
 */

/** Chave pública, exposta ao navegador. Sujeita ao RLS. */
export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/** Chave secreta, exclusiva do servidor. IGNORA o RLS — nunca no cliente. */
export const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

/** `true` quando já estamos no sistema novo — útil para diagnóstico. */
export const usingNewKeyFormat = Boolean(
  supabasePublishableKey?.startsWith("sb_publishable_")
)
