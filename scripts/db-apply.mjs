#!/usr/bin/env node
// Aplica (COMMIT) um arquivo .sql no banco linkado — usado para o seed de dev.
// Diferente de db-test.mjs (que roda em transação com rollback), este persiste.
// Uso: node scripts/db-apply.mjs <arquivo.sql>
// Requer SUPABASE_DB_URL (auto-carrega de .env.supabase-dev se não estiver no ambiente).

import { readFileSync, existsSync } from "node:fs";
import pg from "pg";

const file = process.argv[2];
if (!file) {
  console.error("uso: node scripts/db-apply.mjs <arquivo.sql>");
  process.exit(2);
}
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
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  await client.query("begin");
  await client.query(sql); // protocolo simples: roda múltiplos statements do arquivo
  await client.query("commit");
  console.log("APPLIED " + file);
} catch (err) {
  try { await client.query("rollback"); } catch {}
  console.error("ERRO ao aplicar:", err.message);
  await client.end();
  process.exit(1);
} finally {
  try { await client.end(); } catch {}
}
process.exit(0);
