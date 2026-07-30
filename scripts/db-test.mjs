#!/usr/bin/env node
// Test-runner de SQL para o Plano 1 (Opção B — Supabase na nuvem, sem psql).
// Uso: node scripts/db-test.mjs <arquivo.test.sql>
// Semântica: roda o arquivo dentro de UMA transação (rollback ao final, não muta),
// executando cada statement (split simples por ';') na MESMA conexão — assim
// `set local ...` e claims de JWT persistem entre statements.
// Convenção: um arquivo de teste "passa" se NENHUM statement retornar linhas.
// Qualquer linha retornada é tratada como uma falha de asserção.
// Requer a env SUPABASE_DB_URL. NÃO usar em arquivos com dollar-quotes ($$...$$)
// — migrations são aplicadas via `npx supabase db push`, não por este runner.

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
const statements = sql
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

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
