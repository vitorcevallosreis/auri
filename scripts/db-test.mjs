#!/usr/bin/env node
// Test-runner de SQL para o Plano 1 (Opção B — Supabase na nuvem, sem psql).
// Uso: node scripts/db-test.mjs <arquivo.test.sql>
// Semântica: roda o arquivo dentro de UMA transação (rollback ao final, não muta),
// executando cada statement (split simples por ';') na MESMA conexão — assim
// `set local ...` e claims de JWT persistem entre statements.
// Convenção: um arquivo de teste "passa" se NENHUM statement retornar linhas.
// Qualquer linha retornada é tratada como uma falha de asserção.
// Requer a env SUPABASE_DB_URL. Dollar-quotes ($$...$$, $tag$...$tag$) são
// respeitados no split, então blocos `do $$ ... $$` funcionam — ainda assim,
// migrations são aplicadas via `npx supabase db push`, não por este runner.

import { readFileSync, existsSync } from "node:fs";
import pg from "pg";

const file = process.argv[2];
if (!file) {
  console.error("uso: node scripts/db-test.mjs <arquivo.test.sql>");
  process.exit(2);
}

// Auto-carrega SUPABASE_DB_URL de .env.supabase-dev se não estiver no ambiente.
if (!process.env.SUPABASE_DB_URL && existsSync(".env.supabase-dev")) {
  for (const line of readFileSync(".env.supabase-dev", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL não definida (source .env.supabase-dev)");
  process.exit(2);
}

// O host direto (db.<ref>.supabase.co) só publica AAAA — é IPv6-only. Em rede
// sem IPv6 ele falha com EHOSTUNREACH, e o Plano 1 já tinha registrado essa
// conexão como frágil. O pooler (Supavisor) publica IPv4 e serve o mesmo banco,
// mudando só o formato do usuário: postgres.<ref> em vez de postgres.
//
// Ordem: tenta o que está configurado; se o host não resolver ou não for
// alcançável, cai para o pooler automaticamente em vez de exigir que cada
// máquina descubra isso na mão.
function poolerFallback(direct) {
  try {
    const u = new URL(direct);
    const parts = u.hostname.split(".");
    if (parts[0] !== "db" || !parts[1]) return null;

    const ref = parts[1];
    const region = process.env.SUPABASE_DB_REGION ?? "sa-east-1";
    const host = process.env.SUPABASE_DB_POOLER_HOST
      ?? `aws-1-${region}.pooler.supabase.com`;

    return `postgresql://postgres.${ref}:${u.password}@${host}:5432${u.pathname}`;
  } catch {
    return null;
  }
}

const candidates = [url, poolerFallback(url)].filter(Boolean);

async function connectWithFallback() {
  let lastErr;
  for (const [i, candidate] of candidates.entries()) {
    const c = new pg.Client({
      connectionString: candidate,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });
    try {
      await c.connect();
      if (i > 0) console.error("(host direto indisponível — usando o pooler)");
      return c;
    } catch (err) {
      lastErr = err;
      try { await c.end(); } catch {}
    }
  }
  throw lastErr;
}

// Remove comentários de linha (-- ... até o fim da linha) ANTES de dividir por ';',
// senão um statement precedido por comentário na mesma "chunk" seria descartado
// e a asserção silenciosamente ignorada. (Os arquivos .test.sql não usam '--'
// dentro de literais de string, então isso é seguro para eles.)
const sql = readFileSync(file, "utf8")
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");

/**
 * Divide por ';' RESPEITANDO dollar-quotes ($$ ... $$ e $tag$ ... $tag$).
 *
 * O split ingênuo por ';' partia qualquer bloco `do $$ ... end $$` no primeiro
 * ponto-e-vírgula do corpo, e cada pedaço chegava ao banco como SQL inválido.
 * Era por isso que o cabeçalho deste arquivo mandava não usar o runner com
 * dollar-quotes — o que, na prática, proibia testar qualquer coisa que
 * dependesse de plpgsql, ou seja: todo caso em que a asserção é "isto deveria
 * levantar exceção". 0022 é exatamente esse caso.
 *
 * Literais de aspas simples TAMBÉM são respeitados. A versão anterior os
 * deixava de fora dizendo que nenhum arquivo teria ';' dentro de string — o
 * que valia para os .test.sql e deixou de valer no primeiro `comment on ... is
 * '...; ...'` de uma migration: o statement era partido no meio da string e o
 * banco recusava com "unterminated quoted string", apontando para um erro de
 * sintaxe que não existia.
 *
 * O escape do SQL para aspas dentro de string é DOBRAR a aspa (''), não a
 * barra invertida. Como '' é lido aqui como "fecha e reabre", o resultado é o
 * mesmo e não precisa de caso especial.
 */
function splitStatements(text) {
  const out = [];
  let buf = "";
  let dollarTag = null; // tag do dollar-quote aberto, ou null
  let emAspas = false;  // dentro de literal '...'

  for (let i = 0; i < text.length; i++) {
    if (emAspas) {
      buf += text[i];
      if (text[i] === "'") emAspas = false;
      continue;
    }

    if (!dollarTag && text[i] === "'") {
      emAspas = true;
      buf += text[i];
      continue;
    }

    if (dollarTag) {
      if (text.startsWith(dollarTag, i)) {
        buf += dollarTag;
        i += dollarTag.length - 1;
        dollarTag = null;
        continue;
      }
      buf += text[i];
      continue;
    }

    const abre = /^\$[A-Za-z_]*\$/.exec(text.slice(i));
    if (abre) {
      dollarTag = abre[0];
      buf += dollarTag;
      i += dollarTag.length - 1;
      continue;
    }

    if (text[i] === ";") {
      out.push(buf);
      buf = "";
      continue;
    }
    buf += text[i];
  }
  out.push(buf);

  return out.map((s) => s.trim()).filter((s) => s.length > 0);
}

const statements = splitStatements(sql);

let client;
try {
  client = await connectWithFallback();
} catch (err) {
  console.error("ERRO ao conectar no banco:", err.message);
  process.exit(1);
}

const failures = [];
try {
  await client.query("begin");
  for (const stmt of statements) {
    const res = await client.query(stmt);
    if (res && Array.isArray(res.rows) && res.rows.length > 0) {
      for (const row of res.rows) failures.push(Object.values(row).join(" | "));
    }
  }
  await client.query("rollback");
} catch (err) {
  console.error("ERRO ao executar o teste:", err.message);
  try { await client.query("rollback"); } catch {}
  await client.end();
  process.exit(1);
} finally {
  try { await client.end(); } catch {}
}

if (failures.length > 0) {
  console.error(`FAIL (${failures.length} asserção(ões)):`);
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("PASS");
process.exit(0);
