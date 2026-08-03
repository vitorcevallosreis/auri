#!/usr/bin/env node
// Roda um .sql de AUDITORIA e imprime o resultado de cada consulta.
// Uso: node scripts/db-audit.mjs <arquivo.sql>
//
// Difere de db-test.mjs no essencial: lá "retornou linha" significa falha de
// asserção; aqui as linhas SÃO o produto. E a transação é `read only`, não
// rollback — auditoria não pode alterar a cena que está examinando, nem por
// engano num statement mal colado.
//
// O cabeçalho que precede cada consulta no .sql é impresso junto: sem ele a
// saída vira uma pilha de tabelas sem contexto, e o ponto da auditoria é
// justamente saber o que cada número significa.

import { readFileSync, existsSync } from "node:fs";
import pg from "pg";

const file = process.argv[2];
if (!file) {
  console.error("uso: node scripts/db-audit.mjs <arquivo.sql>");
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
  console.error("SUPABASE_DB_URL não definida (veja .env.supabase-dev)");
  process.exit(2);
}

// Split por ';' respeitando string simples, dollar-quote e comentário de linha.
function statements(sql) {
  const out = [];
  let buf = "", i = 0, aspas = false, tag = null;
  while (i < sql.length) {
    const c = sql[i];
    if (tag) {
      if (sql.startsWith(tag, i)) { buf += tag; i += tag.length; tag = null; continue; }
    } else if (aspas) {
      if (c === "'") aspas = false;
    } else if (c === "'") {
      aspas = true;
    } else if (c === "-" && sql[i + 1] === "-") {
      const fim = sql.indexOf("\n", i);
      buf += sql.slice(i, fim === -1 ? sql.length : fim);
      i = fim === -1 ? sql.length : fim;
      continue;
    } else {
      const m = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
      if (m) { tag = m[0]; buf += tag; i += tag.length; continue; }
      if (c === ";") { out.push(buf); buf = ""; i++; continue; }
    }
    buf += c;
    i++;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

// O comentário imediatamente acima da consulta é o rótulo dela.
function rotulo(bruto) {
  const linhas = bruto.split("\n").map((l) => l.trim());
  const coment = linhas.filter((l) => l.startsWith("--") && !/^-{3,}$/.test(l.replace(/^--\s*/, "")));
  const titulo = coment.find((l) => /^--\s*[A-G]\d*[a-z]?\./.test(l));
  return (titulo ?? coment[0] ?? "").replace(/^--\s?/, "").trim();
}

function imprime(res) {
  if (!res.rows.length) return console.log("     (nenhuma linha)");
  const cols = res.fields.map((f) => f.name);
  const larg = cols.map((c) =>
    Math.min(60, Math.max(c.length, ...res.rows.map((r) => String(r[c] ?? "").replace(/\s+/g, " ").length)))
  );
  const linha = (vals) =>
    "     " + vals.map((v, i) => String(v ?? "").replace(/\s+/g, " ").slice(0, larg[i]).padEnd(larg[i])).join("  ");
  console.log(linha(cols));
  console.log("     " + larg.map((w) => "-".repeat(w)).join("  "));
  for (const r of res.rows) console.log(linha(cols.map((c) => r[c])));
  console.log(`     (${res.rows.length} linha${res.rows.length === 1 ? "" : "s"})`);
}

const sql = readFileSync(file, "utf8")
  // `\set` é meta-comando do psql; as consultas já trazem a data literal.
  .split("\n").filter((l) => !l.trimStart().startsWith("\\")).join("\n");

// O host direto (db.<ref>.supabase.co) é IPv6-only; em rede sem IPv6 ele falha
// com EHOSTUNREACH. Mesmo fallback de db-test.mjs, pelo mesmo motivo — o
// pooler publica IPv4 e serve o mesmo banco, mudando só o formato do usuário.
function poolerFallback(direct) {
  try {
    const u = new URL(direct);
    const parts = u.hostname.split(".");
    if (parts[0] !== "db" || !parts[1]) return null;
    const ref = parts[1];
    const region = process.env.SUPABASE_DB_REGION ?? "sa-east-1";
    const host = process.env.SUPABASE_DB_POOLER_HOST ?? `aws-1-${region}.pooler.supabase.com`;
    return `postgresql://postgres.${ref}:${u.password}@${host}:5432${u.pathname}`;
  } catch {
    return null;
  }
}

async function conectar() {
  let ultimo;
  for (const [i, candidato] of [url, poolerFallback(url)].filter(Boolean).entries()) {
    const c = new pg.Client({
      connectionString: candidato,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });
    try {
      await c.connect();
      if (i > 0) console.error("(host direto indisponível — usando o pooler)");
      return c;
    } catch (err) {
      ultimo = err;
      try { await c.end(); } catch {}
    }
  }
  throw ultimo;
}

const client = await conectar();
await client.query("begin read only");

let n = 0;
for (const bruto of statements(sql)) {
  if (!bruto.replace(/--[^\n]*/g, "").trim()) continue;
  n++;
  console.log(`\n[${n}] ${rotulo(bruto) || "(sem rótulo)"}`);
  try {
    imprime(await client.query(bruto));
  } catch (e) {
    // Uma consulta que falha não pode abortar a auditoria: numa transação a
    // falha envenena as seguintes, então volta-se ao savepoint e segue.
    console.log(`     ERRO: ${e.message}`);
    await client.query("rollback; begin read only").catch(() => {});
  }
}

await client.query("rollback").catch(() => {});
await client.end();
console.log(`\n${n} consultas executadas.`);
