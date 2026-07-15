#!/usr/bin/env node
// Cria os usuários de LOGIN de desenvolvimento via Supabase Admin API (GoTrue) e
// vincula cada um à sua empresa em myia_users. Usar a Admin API (não INSERT em
// auth.users por SQL) é o jeito correto — o SQL cru não cria auth.identities e o
// login falha com "Database error querying schema".
//
// Idempotente: se o usuário já existe, reaproveita o id.
// Uso: node scripts/seed-auth.mjs   (lê NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY de .env.local)

import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(2); }

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const USERS = [
  { email: "clinica.a@teste.dev", company_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" },
  { email: "clinica.b@teste.dev", company_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" },
];
const PASSWORD = "senha123";

async function findUserByEmail(email) {
  // pagina até achar (base de dev é pequena)
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email === email);
    if (u) return u;
    if (data.users.length < 200) break;
  }
  return null;
}

for (const { email, company_id } of USERS) {
  let userId;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) {
    const existing = await findUserByEmail(email);
    if (!existing) { console.error(`falha criando ${email}: ${error.message}`); process.exit(1); }
    userId = existing.id;
    console.log(`${email}: já existia (${userId})`);
  } else {
    userId = data.user.id;
    console.log(`${email}: criado (${userId})`);
  }
  // vincula à empresa (service role bypassa RLS)
  const { error: e2 } = await admin.from("myia_users").upsert({ id: userId, company_id, role: "owner" }, { onConflict: "id" });
  if (e2) { console.error(`falha vinculando ${email} -> ${company_id}: ${e2.message}`); process.exit(1); }
  console.log(`  vinculado à empresa ${company_id}`);
}
console.log("seed-auth: OK");
