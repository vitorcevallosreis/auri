#!/usr/bin/env node
// Popula a AGENDA dos profissionais: quem atende o quê, e em que horários.
//
// Uso:  node scripts/seed-agenda-demo.mjs [company_id]
//       (default: Clínica A — aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa)
//
// POR QUE ESTE SCRIPT EXISTE.
//
// `myia_professional_availability` e `myia_professional_services` estavam com
// ZERO linhas nas cinco empresas, enquanto `myia_appointments` tinha 3.740. O
// seed de demonstração criou o histórico direto, sem nunca criar a agenda de
// onde ele teria saído.
//
// Isso não é cosmético. `consultar_disponibilidade` (worker/tools.mts) faz
//
//     if (!availability?.length) return { ..., horarios: [] }
//
// então, sem estas linhas, o agente responde "não tenho horário" para sempre —
// e o sintoma parece persona mal escrita, não catálogo vazio. Todo o P3.4
// (agendar/remarcar) fica inalcançável junto, porque as três tools recusam o
// que está fora da janela publicada.
//
// É IDEMPOTENTE, no mesmo desenho de seed-dashboard-demo.mjs: id determinístico
// com prefixo por entidade e discriminador da empresa no 2º grupo. Rodar de
// novo reescreve exatamente as mesmas linhas; nenhuma linha fora desses
// prefixos é tocada, e a limpeza nunca alcança o tenant vizinho.
//
// ⚠️ Isto é agenda de DEMONSTRAÇÃO. Quando a clínica real entrar, os horários
// dela vêm do cadastro de profissional no painel — não daqui.

import { readFileSync, existsSync } from "node:fs";
import pg from "pg";

const COMPANY_ID = process.argv[2] || "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

if (!process.env.SUPABASE_DB_URL && existsSync(".env.supabase-dev")) {
  for (const line of readFileSync(".env.supabase-dev", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const direct = process.env.SUPABASE_DB_URL;
if (!direct) {
  console.error("SUPABASE_DB_URL não definida (veja .env.supabase-dev)");
  process.exit(2);
}

// Mesma queda para o pooler dos outros runners: o host direto é IPv6-only e
// não resolve em toda rede.
function poolerFallback(url) {
  try {
    const u = new URL(url);
    const m = u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/);
    if (!m) return null;
    const region = process.env.SUPABASE_DB_REGION ?? "sa-east-1";
    u.hostname = process.env.SUPABASE_DB_POOLER_HOST ?? `aws-1-${region}.pooler.supabase.com`;
    u.port = "5432";
    u.username = `postgres.${m[1]}`;
    return u.toString();
  } catch {
    return null;
  }
}

const COMPANY_TAG = COMPANY_ID.replace(/-/g, "").slice(0, 4);
const demoId = (prefix, n) =>
  `${prefix}-${COMPANY_TAG}-4000-8000-${String(n).padStart(12, "0")}`;
const demoLike = (prefix) => `${prefix}-${COMPANY_TAG}-%`;

// Continuam de onde seed-dashboard-demo.mjs parou (d1..d9).
const PREFIX = {
  professionalService: "da000000",
  availability: "db000000",
};

// ---------------------------------------------------------------------------
// Os turnos
// ---------------------------------------------------------------------------
// Segunda a sexta, manhã e tarde, com intervalo de almoço. O intervalo não é
// enfeite: sem ele a agenda vira um bloco de 10h e o agente oferece consulta ao
// meio-dia, que é o tipo de horário que a recepção desmarca depois.
//
// `weekday` é 1=Segunda … 7=Domingo (ISO), a mesma convenção da migration 0006
// e de `isoWeekday()` em worker/tools.mts. Um mapa deslocado aqui faz o agente
// oferecer horário no dia errado, sem erro nenhum em lugar nenhum.
const TURNOS = [
  { start: "08:00:00", end: "12:00:00" },
  { start: "13:00:00", end: "18:00:00" },
];
const DIAS_UTEIS = [1, 2, 3, 4, 5];

const url = direct;
const candidatos = [url, poolerFallback(url)].filter(Boolean);

let client = null;
for (const [i, candidato] of candidatos.entries()) {
  const c = new pg.Client({ connectionString: candidato, ssl: { rejectUnauthorized: false } });
  try {
    await c.connect();
    if (i > 0) console.error("(host direto indisponível — usando o pooler)");
    client = c;
    break;
  } catch (e) {
    await c.end().catch(() => {});
    if (i === candidatos.length - 1) throw e;
  }
}

const q = (text, params) => client.query(text, params);

try {
  await q("begin");

  const { rows: empresa } = await q("select name from myia_companies where id = $1", [COMPANY_ID]);
  if (!empresa.length) throw new Error(`empresa ${COMPANY_ID} não existe`);
  console.log(`empresa: ${empresa[0].name} (${COMPANY_ID})`);

  const { rows: profissionais } = await q(
    `select id, nome, especialidade from myia_professionals_medical
      where company_id = $1 order by nome`,
    [COMPANY_ID],
  );
  const { rows: servicos } = await q(
    `select id, name, tempo_medio from myia_services where company_id = $1 order by name`,
    [COMPANY_ID],
  );

  if (!profissionais.length) throw new Error("empresa sem profissionais cadastrados");
  if (!servicos.length) throw new Error("empresa sem serviços cadastrados");

  console.log(`  ${profissionais.length} profissionais, ${servicos.length} serviços`);

  // -- Limpeza das sobras de execuções anteriores ---------------------------
  // Nenhuma das duas tabelas tem `company_id` (o vínculo é pelo profissional),
  // então o discriminador dentro do id é a ÚNICA coisa que impede a limpeza de
  // alcançar o tenant vizinho. Por isso ele não é opcional.
  for (const [tabela, prefixo] of [
    ["myia_professional_availability", PREFIX.availability],
    ["myia_professional_services", PREFIX.professionalService],
  ]) {
    const { rowCount } = await q(`delete from ${tabela} where id::text like $1`, [
      demoLike(prefixo),
    ]);
    if (rowCount) console.log(`  limpou ${rowCount} de ${tabela}`);
  }

  // -- Quem atende o quê ----------------------------------------------------
  /**
   * Casa o profissional com o serviço da especialidade dele.
   *
   * `especialidade` guarda o NOME, não um id (é o que `listar_profissionais`
   * lê e o que o agente fala em voz alta), e os serviços de demonstração se
   * chamam "Consulta — <Especialidade>". Sem match, cai no primeiro serviço:
   * um profissional sem serviço nenhum é invisível para a disponibilidade.
   */
  function servicoDo(prof) {
    const esp = (prof.especialidade ?? "").trim().toLowerCase();
    return (
      servicos.find((s) => esp && s.name.toLowerCase().includes(esp)) ?? servicos[0]
    );
  }

  let nPS = 0;
  let nAV = 0;

  for (const [i, prof] of profissionais.entries()) {
    const servico = servicoDo(prof);

    await q(
      `insert into myia_professional_services (id, professional_id, service_id, mode, max_people)
       values ($1, $2, $3, 'presencial', 1)`,
      [demoId(PREFIX.professionalService, i + 1), prof.id, servico.id],
    );
    nPS++;

    for (const [d, weekday] of DIAS_UTEIS.entries()) {
      for (const [t, turno] of TURNOS.entries()) {
        // Contador único por (profissional, dia, turno) — é o que torna o id
        // reproduzível entre execuções.
        const n = (i + 1) * 100 + (d + 1) * 10 + (t + 1);
        await q(
          `insert into myia_professional_availability
             (id, professional_id, service_id, weekday, start_time, end_time,
              max_simultaneous_clients)
           values ($1, $2, $3, $4, $5, $6, 1)`,
          [demoId(PREFIX.availability, n), prof.id, servico.id, weekday, turno.start, turno.end],
        );
        nAV++;
      }
    }

    console.log(`  ${prof.nome} → ${servico.name} (${servico.tempo_medio ?? "sem tempo_medio"})`);
  }

  await q("commit");
  console.log(`\nOK — ${nPS} vínculos profissional–serviço, ${nAV} janelas de atendimento`);
  console.log("Seg–Sex, 08:00–12:00 e 13:00–18:00, 1 paciente por vez.");
} catch (e) {
  await q("rollback").catch(() => {});
  console.error("FALHOU:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
