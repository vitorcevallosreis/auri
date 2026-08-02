#!/usr/bin/env node
// Popula o banco com dados de demonstração para o painel da conta de teste.
//
// Por que existe: o painel exibia números literais no front (1.234 consultas,
// 4.8 de satisfação, NPS 75, séries dos dois gráficos). Dado inventado no
// componente é indistinguível de dado real quando a conta é de verdade. Este
// script move a ficção para onde ela pode ser inspecionada, filtrada por tenant
// e eventualmente apagada: o banco.
//
// Uso:  node scripts/seed-dashboard-demo.mjs [company_id]
//       (default: Clínica A — aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa)
//
// É IDEMPOTENTE: toda linha gerada usa um id determinístico com prefixo `d?000000`.
// Rodar de novo reescreve exatamente as mesmas linhas e remove sobras de execuções
// anteriores. Nenhuma linha fora desses prefixos é tocada.

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
  console.error("SUPABASE_DB_URL não definida (source .env.supabase-dev)");
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Aleatoriedade determinística: mesma semente -> mesmo banco. Sem isso, cada
// execução mexeria nos números do painel e nada seria reproduzível.
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260801);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (min, max) => min + Math.floor(rand() * (max - min + 1));

// Discriminador da empresa dentro do próprio id.
//
// Sem isto o seed é DESTRUTIVO entre empresas: os ids eram fixos, a limpeza
// apagava por prefixo em toda a tabela, e rodar para a segunda empresa apagava
// as linhas da primeira em vez de somar. Com o discriminador, cada empresa tem
// o seu próprio espaço de ids e a limpeza só alcança o que é dela.
const COMPANY_TAG = COMPANY_ID.replace(/-/g, "").slice(0, 4);

/** id determinístico: prefixo = entidade, 2º grupo = empresa, fim = contador. */
const demoId = (prefix, n) =>
  `${prefix}-${COMPANY_TAG}-4000-8000-${String(n).padStart(12, "0")}`;

/** Padrão LIKE que casa só com as linhas de demonstração DESTA empresa. */
const demoLike = (prefix) => `${prefix}-${COMPANY_TAG}-%`;

const PREFIX = {
  specialty: "d1000000",
  service: "d2000000",
  professional: "d3000000",
  contact: "d4000000",
  appointment: "d5000000",
  feedback: "d6000000",
  search: "d7000000",
  chat: "d8000000",
  message: "d9000000",
};

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------
const SPECIALTIES = [
  { name: "Clínica Geral", price: 250, minutes: 30, weight: 26 },
  { name: "Cardiologia", price: 420, minutes: 45, weight: 20 },
  { name: "Dermatologia", price: 380, minutes: 30, weight: 18 },
  { name: "Pediatria", price: 300, minutes: 30, weight: 15 },
  { name: "Ortopedia", price: 450, minutes: 45, weight: 12 },
  { name: "Ginecologia", price: 400, minutes: 40, weight: 9 },
];

const PROFESSIONALS = [
  { nome: "Dra. Helena Marques", especialidade: "Clínica Geral", registro: "CRM-SP 118432" },
  { nome: "Dr. Rafael Okamoto", especialidade: "Cardiologia", registro: "CRM-SP 92310" },
  { nome: "Dra. Beatriz Salles", especialidade: "Dermatologia", registro: "CRM-SP 134907" },
  { nome: "Dr. Caio Fontenele", especialidade: "Pediatria", registro: "CRM-SP 107755" },
  { nome: "Dra. Lívia Andrade", especialidade: "Ortopedia", registro: "CRM-SP 121064" },
  { nome: "Dra. Marina Duarte", especialidade: "Ginecologia", registro: "CRM-SP 99820" },
];

const FIRST = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Felipe", "Gabriela", "Henrique",
  "Isabela", "João", "Karina", "Lucas", "Mariana", "Nelson", "Olívia", "Paulo",
  "Renata", "Sérgio", "Tatiana", "Vinícius", "Yara", "Rodrigo", "Camila", "Eduardo"];
const LAST = ["Silva", "Souza", "Oliveira", "Pereira", "Costa", "Rodrigues", "Almeida",
  "Nascimento", "Lima", "Araújo", "Ribeiro", "Carvalho", "Gomes", "Martins"];

const COMMENTS = [
  "Atendimento excelente, fui muito bem recebida.",
  "Médico atencioso, explicou tudo com calma.",
  "Consegui marcar pelo WhatsApp em dois minutos.",
  "Demorou um pouco para ser chamado, mas a consulta foi ótima.",
  "Recepção poderia ser mais rápida.",
  null,
  null,
  null,
];

// ---------------------------------------------------------------------------
// Datas: os 7 meses que o gráfico "Volume de Consultas" mostra, terminando no
// mês corrente. O mês corrente recebe agendamentos futuros também, senão a
// comparação mês-a-mês compararia um mês inteiro com um mês pela metade.
// ---------------------------------------------------------------------------
const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);
const MONTHS_BACK = 6;
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hhmm = (h, m) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;

function addMinutes(h, m, minutes) {
  const total = h * 60 + m + minutes;
  return [Math.floor(total / 60), total % 60];
}

// Horários de atendimento: 08h-18h, com pico no meio da manhã e meio da tarde.
const SLOT_HOURS = [8, 9, 10, 11, 12, 14, 15, 16, 17];
const HOUR_WEIGHT = { 8: 8, 9: 14, 10: 16, 11: 13, 12: 6, 14: 12, 15: 14, 16: 11, 17: 6 };

function weightedPick(items, weightOf) {
  const total = items.reduce((s, i) => s + weightOf(i), 0);
  let r = rand() * total;
  for (const i of items) {
    r -= weightOf(i);
    if (r <= 0) return i;
  }
  return items[items.length - 1];
}

// ---------------------------------------------------------------------------
const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

async function q(text, params) {
  return client.query(text, params);
}

try {
  await q("begin");

  const { rows: companyRows } = await q("select name from myia_companies where id = $1", [COMPANY_ID]);
  if (!companyRows.length) throw new Error(`empresa ${COMPANY_ID} não existe`);
  console.log(`empresa: ${companyRows[0].name} (${COMPANY_ID})`);

  // -- Limpeza das sobras de execuções anteriores --
  //
  // Dois filtros, de propósito: o padrão do id já é exclusivo desta empresa, e
  // o company_id repete a restrição onde a coluna existe. É barato e garante
  // que um erro no padrão não vaze para o tenant vizinho. myia_messages não tem
  // company_id (o vínculo é via chat), então ali só o padrão vale — e por isso
  // ele precisa mesmo carregar o discriminador da empresa.
  // Ordem respeita as FKs.
  for (const [table, prefix, temCompanyId] of [
    ["myia_appointment_feedback", PREFIX.feedback, true],
    ["myia_services_searches", PREFIX.search, true],
    ["myia_messages", PREFIX.message, false],
    ["myia_chat", PREFIX.chat, true],
    ["myia_appointments", PREFIX.appointment, true],
    ["myia_contacts", PREFIX.contact, true],
    ["myia_professionals_medical", PREFIX.professional, true],
    ["myia_services", PREFIX.service, true],
    ["myia_specialties", PREFIX.specialty, true],
  ]) {
    if (temCompanyId) {
      await q(`delete from ${table} where id::text like $1 and company_id = $2`, [demoLike(prefix), COMPANY_ID]);
    } else {
      await q(`delete from ${table} where id::text like $1`, [demoLike(prefix)]);
    }
  }

  // ------------------------------------------------------------------ catálogo
  const specialties = SPECIALTIES.map((s, i) => ({ ...s, id: demoId(PREFIX.specialty, i + 1) }));
  for (const s of specialties) {
    await q(
      `insert into myia_specialties (id, company_id, name, description)
       values ($1,$2,$3,$4)`,
      [s.id, COMPANY_ID, s.name, `Atendimento em ${s.name.toLowerCase()}.`]
    );
  }

  const services = specialties.map((s, i) => ({ ...s, id: demoId(PREFIX.service, i + 1) }));
  for (const s of services) {
    await q(
      `insert into myia_services (id, company_id, name, price, description, tempo_medio, available, aceita_convenio)
       values ($1,$2,$3,$4,$5,$6,true,$7)`,
      [s.id, COMPANY_ID, `Consulta — ${s.name}`, s.price,
       `Consulta de ${s.name.toLowerCase()}.`, `${s.minutes} min`, s.weight % 2 === 0]
    );
  }

  const professionals = PROFESSIONALS.map((p, i) => ({ ...p, id: demoId(PREFIX.professional, i + 1) }));
  for (const p of professionals) {
    await q(
      `insert into myia_professionals_medical (id, company_id, nome, formacao, especialidade, registro, email, telefone)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [p.id, COMPANY_ID, p.nome, "Medicina", p.especialidade, p.registro,
       `${p.nome.split(" ").pop().toLowerCase()}@clinica-a.teste`, `+55119${between(10000000, 99999999)}`]
    );
  }

  // ------------------------------------------------------------------ pacientes
  const contacts = [];
  for (let i = 1; i <= 60; i++) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const number = `55119${between(10000000, 99999999)}`;
    contacts.push({ id: demoId(PREFIX.contact, i), name, number });
    await q(
      `insert into myia_contacts (id, company_id, name, remote_jid, number, checked)
       values ($1,$2,$3,$4,$5,true)`,
      [contacts[i - 1].id, COMPANY_ID, name, `${number}@s.whatsapp.net`, number]
    );
  }

  // -------------------------------------------------------------- agendamentos
  // Distribuição de status: passado fecha em completed na maioria; futuro fica
  // scheduled. Cancelamento e falta existem para a taxa de cancelamento e a de
  // comparecimento não serem constantes.
  const appointments = [];
  let apptN = 0;

  const firstMonth = new Date(TODAY.getFullYear(), TODAY.getMonth() - MONTHS_BACK, 1);
  const lastDay = new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0);

  for (let d = new Date(firstMonth); d <= lastDay; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day === 0) continue;                       // domingo fechado
    const perDay = day === 6 ? between(2, 5) : between(7, 14); // sábado reduzido

    // Crescimento leve mês a mês, para a linha do gráfico ter tendência.
    const monthsFromStart =
      (d.getFullYear() - firstMonth.getFullYear()) * 12 + (d.getMonth() - firstMonth.getMonth());
    const growth = 1 + monthsFromStart * 0.045;
    const count = Math.max(1, Math.round(perDay * growth));

    const usedSlots = new Set();
    for (let k = 0; k < count; k++) {
      const service = weightedPick(services, (s) => s.weight);
      const professional =
        professionals.find((p) => p.especialidade === service.name) || pick(professionals);
      const hour = weightedPick(SLOT_HOURS, (h) => HOUR_WEIGHT[h]);
      const minute = pick([0, 15, 30, 45]);
      const slotKey = `${professional.id}-${hour}-${minute}`;
      if (usedSlots.has(slotKey)) continue;        // sem dois pacientes no mesmo horário
      usedSlots.add(slotKey);

      // Duração real varia em torno do tempo previsto do serviço.
      const duration = Math.max(15, service.minutes + between(-10, 15));
      const [endH, endM] = addMinutes(hour, minute, duration);

      const isFuture = d > TODAY;
      let status;
      if (isFuture) {
        status = rand() < 0.06 ? "cancelled" : "scheduled";
      } else {
        const r = rand();
        status = r < 0.82 ? "completed"
          : r < 0.90 ? "cancelled"
          : r < 0.96 ? "no_show"
          : "rescheduled";
      }

      const contact = pick(contacts);
      const id = demoId(PREFIX.appointment, ++apptN);
      // created_at: marcado alguns dias antes da consulta.
      const createdAt = new Date(d);
      createdAt.setDate(createdAt.getDate() - between(1, 21));

      appointments.push({ id, date: iso(d), hour, minute, duration, status, service, contact });

      await q(
        `insert into myia_appointments
           (id, company_id, professional_id, service_id, client_id, appointment_date,
            start_time, end_time, status, appointment_type, valor_cobrado,
            cliente_nome, cliente_telefone, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'individual',$10,$11,$12,$13,$13)`,
        [id, COMPANY_ID, professional.id, service.id, contact.id, iso(d),
         hhmm(hour, minute), hhmm(endH, endM), status,
         status === "completed" ? service.price : null,
         contact.name, contact.number, createdAt.toISOString()]
      );
    }
  }

  // ------------------------------------------------------------------ pesquisa
  // Só quem foi atendido responde, e nem todos respondem (~55%).
  let fbN = 0;
  const completed = appointments.filter((a) => a.status === "completed");
  for (const appt of completed) {
    if (rand() > 0.55) continue;
    // Distribuição realista: maioria promotora, uma cauda de detratores.
    const r = rand();
    const nps = r < 0.62 ? between(9, 10) : r < 0.83 ? between(7, 8) : between(0, 6);
    const rating = nps >= 9 ? between(4, 5) : nps >= 7 ? 4 : between(1, 3);
    const createdAt = new Date(`${appt.date}T${hhmm(appt.hour, appt.minute)}`);
    createdAt.setHours(createdAt.getHours() + between(2, 48));
    await q(
      `insert into myia_appointment_feedback
         (id, company_id, appointment_id, rating, nps_score, comment, created_at)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [demoId(PREFIX.feedback, ++fbN), COMPANY_ID, appt.id, rating, nps, pick(COMMENTS), createdAt.toISOString()]
    );
  }

  // ------------------------------------------- buscas de serviço (últimos 30d)
  let searchN = 0;
  for (let i = 0; i < 320; i++) {
    const service = weightedPick(services, (s) => s.weight);
    const when = new Date(TODAY);
    when.setDate(when.getDate() - between(0, 29));
    when.setHours(between(8, 20), between(0, 59), 0, 0);
    await q(
      `insert into myia_services_searches (id, company_id, service_id, created_at)
       values ($1,$2,$3,$4)`,
      [demoId(PREFIX.search, ++searchN), COMPANY_ID, service.id, when.toISOString()]
    );
  }

  // ------------------------------------------------ conversas de WhatsApp
  // Alimentam o card "Tempo de Espera": o intervalo entre a mensagem do
  // paciente e a resposta seguinte da assistente.
  let chatN = 0;
  let msgN = 0;
  for (let i = 0; i < 45; i++) {
    const contact = pick(contacts);
    const chatId = demoId(PREFIX.chat, ++chatN);
    const started = new Date(TODAY);
    started.setDate(started.getDate() - between(0, 20));
    started.setHours(between(8, 19), between(0, 59), 0, 0);

    await q(
      `insert into myia_chat (id, company_id, contact_id, channel_name, muted, archived, bot_running, chat_pause, created_at)
       values ($1,$2,$3,'whatsapp',false,false,true,false,$4)`,
      [chatId, COMPANY_ID, contact.id, started.toISOString()]
    );

    let cursor = new Date(started);
    const turns = between(2, 5);
    for (let t = 0; t < turns; t++) {
      // Paciente pergunta.
      const inbound = new Date(cursor);
      await q(
        `insert into myia_messages (id, chat_id, from_me, message_type, message, message_timestamp, status, created_at)
         values ($1,$2,false,'conversation',$3,$4,'received',$5)`,
        [demoId(PREFIX.message, ++msgN), chatId,
         JSON.stringify({ conversation: "Oi, gostaria de marcar uma consulta." }),
         Math.floor(inbound.getTime() / 1000), inbound.toISOString()]
      );

      // Assistente responde entre 20s e 3min depois.
      const replyDelay = between(20, 180);
      const outbound = new Date(inbound.getTime() + replyDelay * 1000);
      await q(
        `insert into myia_messages (id, chat_id, from_me, message_type, message, message_timestamp, status, created_at)
         values ($1,$2,true,'conversation',$3,$4,'sent',$5)`,
        [demoId(PREFIX.message, ++msgN), chatId,
         JSON.stringify({ conversation: "Claro! Temos horários disponíveis nesta semana." }),
         Math.floor(outbound.getTime() / 1000), outbound.toISOString()]
      );

      cursor = new Date(outbound.getTime() + between(60, 900) * 1000);
    }
  }

  await q("commit");

  console.log(`
especialidades ....... ${specialties.length}
serviços ............. ${services.length}
profissionais ........ ${professionals.length}
pacientes ............ ${contacts.length}
agendamentos ......... ${appointments.length}  (${completed.length} realizados)
respostas de pesquisa  ${fbN}
buscas de serviço .... ${searchN}
conversas ............ ${chatN}  (${msgN} mensagens)`);
} catch (err) {
  await q("rollback").catch(() => {});
  console.error("ROLLBACK —", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
