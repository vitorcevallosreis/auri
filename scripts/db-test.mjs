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

const sql = readFileSync(file, "utf8");
const statements = sql
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

const failures = [];
try {
  await client.connect();
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
