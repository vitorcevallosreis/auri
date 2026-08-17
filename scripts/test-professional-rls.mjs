#!/usr/bin/env node
// Testa o isolamento por papel introduzido em 0018-0020.
//
// Por que não usar scripts/db-test.mjs: aquele runner considera "falha" qualquer
// statement que devolva linhas, o que cobre bem asserções de VAZAMENTO — mas não
// sabe afirmar "este comando DEVE dar erro". Um INSERT barrado pelo RLS aborta a
// transação e ele reporta erro de execução, não falha de teste. Negação de
// escrita é justamente o centro desta mudança, então vale um runner próprio.
//
// Três famílias de asserção:
//   vazamento  — o profissional NÃO pode ver isto        (espera 0 linhas)
//   presença   — o profissional PRECISA ver isto         (espera > 0 linhas)
//   escrita    — o profissional NÃO pode gravar isto     (espera erro)
//   regressão  — o owner continua vendo tudo             (espera > 0 linhas)
//
// Tudo roda numa transação com rollback. Uso:
//   node scripts/test-professional-rls.mjs [company_id]

import { readFileSync, existsSync } from "node:fs";
import pg from "pg";

const COMPANY_ID = process.argv[2] || "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

if (!process.env.SUPABASE_DB_URL && existsSync(".env.supabase-dev")) {
  for (const line of readFileSync(".env.supabase-dev", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
if (!process.env.SUPABASE_DB_URL) {
  console.error("SUPABASE_DB_URL não definida (.env.supabase-dev)");
  process.exit(2);
}

const c = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

const resultados = [];
const registra = (familia, nome, ok, detalhe = "") =>
  resultados.push({ familia, nome, ok, detalhe });

/** Assume a identidade de um usuário da aplicação dentro da transação. */
async function comoUsuario(uid) {
  await c.query("set local role authenticated");
  await c.query("select set_config('request.jwt.claims', $1, true)",
    [JSON.stringify({ sub: uid, role: "authenticated" })]);
}
async function comoServico() {
  await c.query("reset role");
  await c.query("select set_config('request.jwt.claims', '', true)");
}

/** Espera zero linhas — ou negação no nível de GRANT, que é ainda mais forte.
 *
 *  Algumas tabelas criadas depois de 0009_grants (myia_agent_jobs, por exemplo)
 *  nunca receberam grant para `authenticated`, então a negação vem do Postgres
 *  antes mesmo de o RLS ser consultado. Para efeito de isolamento tanto faz —
 *  o dado não sai —, mas o teste precisa distinguir isso de um erro de verdade,
 *  em vez de abortar a suíte inteira. */
async function semVazamento(nome, sql, params = []) {
  await c.query("savepoint leitura");
  try {
    const r = await c.query(sql, params);
    await c.query("release savepoint leitura");
    registra("vazamento", nome, r.rows.length === 0, `${r.rows.length} linha(s)`);
  } catch (err) {
    await c.query("rollback to savepoint leitura");
    const negadoPorGrant = /permission denied/i.test(err.message);
    registra("vazamento", nome, negadoPorGrant,
      negadoPorGrant ? "negado por grant" : err.message.slice(0, 60));
  }
}

/** Espera pelo menos uma linha. Escopo apertado demais é tão bug quanto vazar. */
async function comAcesso(familia, nome, sql, params = []) {
  const r = await c.query(sql, params);
  registra(familia, nome, r.rows.length > 0, `${r.rows.length} linha(s)`);
}

/** A escrita tem de ser barrada — e o RLS barra de DUAS formas diferentes:
 *
 *  INSERT sem policy de INSERT levanta erro ("new row violates row-level
 *  security policy"). Mas UPDATE e DELETE sem a policy correspondente NÃO
 *  levantam nada: as linhas simplesmente não ficam visíveis para alteração e o
 *  comando afeta zero linhas, silenciosamente. Conferir só a exceção daria
 *  falso alarme em todo UPDATE — foi exatamente o que aconteceu na primeira
 *  execução desta suíte.
 *
 *  Então o critério é: erro de RLS OU zero linhas afetadas. Qualquer linha
 *  afetada é brecha de verdade.
 *
 *  Savepoint em volta para o erro não abortar a transação inteira. */
async function escritaNegada(nome, sql, params = []) {
  await c.query("savepoint tentativa");
  try {
    const r = await c.query(sql, params);
    await c.query("rollback to savepoint tentativa");
    registra("escrita", nome, r.rowCount === 0,
      r.rowCount === 0 ? "0 linhas afetadas" : `GRAVOU ${r.rowCount} linha(s)`);
  } catch (err) {
    await c.query("rollback to savepoint tentativa");
    const barrado = /row-level security|permission denied/i.test(err.message);
    registra("escrita", nome, barrado, barrado ? "erro de RLS" : err.message.slice(0, 60));
  }
}

try {
  await c.query("begin");

  // Descobre os atores em vez de chumbar UUID: o seed recria os usuários e os
  // ids do GoTrue mudam a cada recriação.
  const { rows: atores } = await c.query(
    `select u.id, u.role, u.professional_id
     from myia_users u where u.company_id = $1 order by u.role desc, u.id`,
    [COMPANY_ID]);
  const medico = atores.find((a) => a.role === "professional");
  const dono = atores.find((a) => a.role === "owner");
  if (!medico) throw new Error("nenhum usuário 'professional' nesta empresa — rode scripts/seed-professional-access.mjs");
  if (!dono) throw new Error("nenhum usuário 'owner' nesta empresa");

  console.log(`empresa ......... ${COMPANY_ID}`);
  console.log(`médico .......... ${medico.id} (professional_id ${medico.professional_id})`);
  console.log(`owner ........... ${dono.id}\n`);

  // ===================================================== COMO O PROFISSIONAL
  await comoUsuario(medico.id);

  registra("identidade", "app_role() = professional",
    (await c.query("select app_role() as r")).rows[0].r === "professional");
  registra("identidade", "auth_professional_id() correto",
    (await c.query("select auth_professional_id() as p")).rows[0].p === medico.professional_id);

  await semVazamento("agendamento de outro profissional",
    "select 1 from myia_appointments where professional_id <> $1 limit 5", [medico.professional_id]);
  await semVazamento("contato sem atendimento com ele",
    `select 1 from myia_contacts c where not exists (
       select 1 from myia_appointments a where a.client_id = c.id and a.professional_id = $1) limit 5`,
    [medico.professional_id]);
  await semVazamento("prontuário de outro profissional",
    "select 1 from myia_medical_records where professional_id <> $1 limit 5", [medico.professional_id]);
  await semVazamento("feedback de atendimento alheio",
    `select 1 from myia_appointment_feedback f where not exists (
       select 1 from myia_appointments a where a.id = f.appointment_id and a.professional_id = $1) limit 5`,
    [medico.professional_id]);
  await semVazamento("outro profissional do catálogo",
    "select 1 from myia_professionals_medical where id <> $1 limit 5", [medico.professional_id]);
  await semVazamento("linha de outro usuário", "select 1 from myia_users where id <> $1 limit 5", [medico.id]);
  await semVazamento("conversas de WhatsApp", "select 1 from myia_chat limit 1");
  await semVazamento("mensagens", "select 1 from myia_messages limit 1");
  await semVazamento("assistentes de IA", "select 1 from myia_assistants limit 1");
  await semVazamento("convênios da clínica", "select 1 from myia_company_agreements limit 1");
  await semVazamento("formas de pagamento", "select 1 from myia_company_payment_methods limit 1");
  await semVazamento("endereço da clínica", "select 1 from myia_company_addresses limit 1");
  await semVazamento("buscas de serviço", "select 1 from myia_services_searches limit 1");
  await semVazamento("produtos", "select 1 from myia_products limit 1");
  await semVazamento("especialidades", "select 1 from myia_specialties limit 1");
  await semVazamento("números do WhatsApp Cloud", "select 1 from myia_wa_cloud_numbers limit 1");
  await semVazamento("fila de trabalhos do agente", "select 1 from myia_agent_jobs limit 1");
  await semVazamento("execuções do agente", "select 1 from myia_agent_runs limit 1");
  await semVazamento("disponibilidade dos colegas", "select 1 from myia_professional_availability limit 1");

  await comAcesso("presença", "vê os próprios agendamentos", "select 1 from myia_appointments limit 1");
  await comAcesso("presença", "vê os próprios prontuários", "select 1 from myia_medical_records limit 1");
  await comAcesso("presença", "vê os próprios pacientes", "select 1 from myia_contacts limit 1");
  await comAcesso("presença", "vê a própria linha do catálogo",
    "select 1 from myia_professionals_medical where id = $1", [medico.professional_id]);
  await comAcesso("presença", "vê a clínica", "select 1 from myia_companies limit 1");
  await comAcesso("presença", "vê o catálogo de serviços", "select 1 from myia_services limit 1");
  await comAcesso("presença", "vê o próprio feedback", "select 1 from myia_appointment_feedback limit 1");
  await comAcesso("presença", "RPC do dia responde",
    "select 1 where (professional_day_metrics('America/Sao_Paulo')->>'week_total')::int >= 0");
  await comAcesso("presença", "RPC de receita responde",
    "select 1 where (professional_revenue_metrics(6,'America/Sao_Paulo')->>'month_total')::numeric >= 0");

  const { rows: umProntuario } = await c.query("select id from myia_medical_records limit 1");
  const { rows: umAgendamento } = await c.query("select id from myia_appointments limit 1");

  await escritaNegada("editar o próprio prontuário",
    "update myia_medical_records set review_status = 'signed' where id = $1", [umProntuario[0].id]);
  await escritaNegada("apagar o próprio prontuário",
    "delete from myia_medical_records where id = $1", [umProntuario[0].id]);
  await escritaNegada("editar o próprio agendamento",
    "update myia_appointments set status = 'cancelled' where id = $1", [umAgendamento[0].id]);
  await escritaNegada("criar contato",
    "insert into myia_contacts (company_id, name, checked) values ($1, 'Invasor', true)", [COMPANY_ID]);
  await escritaNegada("editar a própria linha do catálogo",
    "update myia_professionals_medical set nome = 'Alterado' where id = $1", [medico.professional_id]);
  await escritaNegada("promover-se a owner",
    "update myia_users set role = 'owner' where id = $1", [medico.id]);

  // ============================================================ COMO O OWNER
  await comoServico();
  await comoUsuario(dono.id);

  registra("identidade", "app_role() do owner", (await c.query("select app_role() as r")).rows[0].r === "owner");

  for (const [nome, tabela] of [
    ["agendamentos", "myia_appointments"], ["contatos", "myia_contacts"],
    ["serviços", "myia_services"], ["profissionais", "myia_professionals_medical"],
    ["feedback", "myia_appointment_feedback"], ["conversas", "myia_chat"],
    ["mensagens", "myia_messages"], ["assistentes", "myia_assistants"],
    ["prontuários", "myia_medical_records"], ["buscas", "myia_services_searches"],
  ]) {
    await comAcesso("regressão", `owner ainda vê ${nome}`, `select 1 from ${tabela} limit 1`);
  }
  await comAcesso("regressão", "owner vê os 6 profissionais",
    "select 1 from myia_professionals_medical having count(*) >= 6");
  await comAcesso("regressão", "owner vê a equipe em myia_users",
    "select 1 from myia_users where company_id = $1 having count(*) > 1", [COMPANY_ID]);

  // O with check é o erro clássico desta reescrita: sem repetir o predicado, o
  // owner perde a escrita. Testado de verdade, não por leitura da policy.
  await c.query("savepoint escrita_owner");
  try {
    await c.query(
      `insert into myia_services (company_id, name, price, available, aceita_convenio)
       values ($1, 'Serviço de teste RLS', 1, true, false)`, [COMPANY_ID]);
    registra("regressão", "owner ainda consegue INSERT", true);
  } catch (err) {
    registra("regressão", "owner ainda consegue INSERT", false, err.message.slice(0, 70));
  }
  await c.query("rollback to savepoint escrita_owner");

  await c.query("savepoint update_owner");
  try {
    await c.query("update myia_contacts set name = name where id = (select id from myia_contacts limit 1)");
    registra("regressão", "owner ainda consegue UPDATE", true);
  } catch (err) {
    registra("regressão", "owner ainda consegue UPDATE", false, err.message.slice(0, 70));
  }
  await c.query("rollback to savepoint update_owner");

  await c.query("rollback");
} catch (err) {
  await c.query("rollback").catch(() => {});
  console.error("ERRO:", err.message);
  process.exitCode = 1;
} finally {
  await c.end();
}

// ------------------------------------------------------------------ relatório
const falhas = resultados.filter((r) => !r.ok);
let familiaAtual = "";
for (const r of resultados) {
  if (r.familia !== familiaAtual) { familiaAtual = r.familia; console.log(`\n[${familiaAtual}]`); }
  console.log(`  ${r.ok ? "ok  " : "FALHA"} ${r.nome}${r.detalhe && !r.ok ? "  — " + r.detalhe : ""}`);
}
console.log(`\n${resultados.length - falhas.length}/${resultados.length} asserções passaram`);
if (falhas.length) {
  console.log(`\n${falhas.length} FALHA(S):`);
  for (const f of falhas) console.log(`  ${f.familia} · ${f.nome} — ${f.detalhe}`);
  process.exitCode = 1;
}
