#!/usr/bin/env node
// Cria os ACESSOS DE MÉDICO da conta de demonstração e gera os prontuários.
//
// Segundo passo do seed, sempre DEPOIS de seed-dashboard-demo.mjs:
//
//   node scripts/seed-dashboard-demo.mjs      <company_id>
//   node scripts/seed-professional-access.mjs <company_id>
//
// Sempre os dois, sempre nessa ordem. O primeiro apaga e recria os profissionais
// (o que cascateia para os logins, por myia_users_professional_fk) e os
// agendamentos (o que cascateia para os prontuários). Rodar só o primeiro deixa
// os médicos sem login e a tela de prontuário vazia.
//
// O que faz:
//   1. cria login para os 3 primeiros profissionais do catálogo de demonstração
//   2. vincula cada um em myia_users com role='professional'
//   3. gera um prontuário para cada atendimento 'completed' desses 3
//
// Idempotente: reaproveita o usuário existente e reescreve os mesmos ids.

import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const COMPANY_ID = process.argv[2] || "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PASSWORD = "senha123";

// Quantos profissionais ganham LOGIN (os demais seguem só no catálogo).
//
// Existe porque a empresa "auri" é a conta do Vitor, não uma vitrine: lá basta
// um médico para testar o papel. A Clínica A, que é a conta de demonstração,
// usa os três. Sem este parâmetro, rodar o seed de novo na auri recriaria as
// contas que foram removidas de propósito.
//
//   node scripts/seed-professional-access.mjs <company_id> [--logins=N]
const LOGIN_COUNT = (() => {
  const arg = process.argv.find((a) => a.startsWith("--logins="));
  const n = arg ? Number(arg.split("=")[1]) : 3;
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 3) : 3;
})();

// Duas fontes de credencial, cada uma no arquivo onde já vive:
//   .env.supabase-dev -> SUPABASE_DB_URL          (padrão de seed-dashboard-demo.mjs)
//   .env.local        -> URL + SERVICE_ROLE_KEY   (padrão de seed-auth.mjs)
for (const file of [".env.supabase-dev", ".env.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const dbUrl = process.env.SUPABASE_DB_URL;
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!dbUrl) { console.error("SUPABASE_DB_URL não definida (.env.supabase-dev)"); process.exit(2); }
if (!apiUrl || !serviceKey) { console.error("faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY (ou a legada SUPABASE_SERVICE_ROLE_KEY) em .env.local"); process.exit(2); }

// PRNG e semente PRÓPRIOS. Consumir do gerador de seed-dashboard-demo.mjs
// deslocaria o stream dele e mudaria todos os números do painel do owner.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260802);
const pick = (a) => a[Math.floor(rand() * a.length)];
const between = (min, max) => min + Math.floor(rand() * (max - min + 1));

// Mesmo esquema de ids de seed-dashboard-demo.mjs: prefixo por entidade,
// discriminador da empresa no 2º grupo, contador no fim.
const COMPANY_TAG = COMPANY_ID.replace(/-/g, "").slice(0, 4);
const PREFIX_PROFESSIONAL = "d3000000";   // tem de casar com o outro script
const PREFIX_RECORD = "da000000";
const demoId = (p, n) => `${p}-${COMPANY_TAG}-4000-8000-${String(n).padStart(12, "0")}`;
const demoLike = (p) => `${p}-${COMPANY_TAG}-%`;

// Os primeiros do catálogo, que são os de maior volume no seed do painel.
// Quem sobrar fica SEM login de propósito: prova que o vínculo é opcional e que
// um profissional pode existir só como registro de agenda, com pacientes e
// prontuários, sem nunca entrar no sistema.
const CANDIDATOS = [
  { n: 1, slug: "helena",  nome: "Dra. Helena Marques", area: "clinica_geral" },
  { n: 2, slug: "rafael",  nome: "Dr. Rafael Okamoto",  area: "cardiologia" },
  { n: 3, slug: "beatriz", nome: "Dra. Beatriz Salles", area: "dermatologia" },
];
const LOGINS = CANDIDATOS.slice(0, LOGIN_COUNT);

// ---------------------------------------------------------------------------
// Biblioteca de texto clínico. Verossímil o bastante para julgar densidade e
// hierarquia na tela, genérico o bastante para não parecer caso real.
// ---------------------------------------------------------------------------
const TEXTOS = {
  clinica_geral: {
    chief_complaint: [
      "Cansaço persistente há cerca de três semanas.",
      "Dor de cabeça recorrente, sobretudo no fim do dia.",
      "Retorno para avaliação de exames de rotina.",
      "Tosse seca há dez dias, sem febre.",
      "Dificuldade para dormir e irritabilidade.",
    ],
    anamnesis: [
      "Paciente relata início insidioso dos sintomas, sem fator desencadeante identificado. Nega febre, perda de peso ou sudorese noturna. Sono irregular nas últimas semanas por questões de trabalho.",
      "Refere piora dos sintomas em períodos de maior carga de trabalho. Alimentação irregular, baixa ingestão hídrica. Nega uso de medicação contínua.",
      "Sem intercorrências desde a última consulta. Aderente às orientações previamente dadas. Trouxe exames solicitados.",
      "Quadro autolimitado, sem sinais de alarme. Contactantes domiciliares assintomáticos. Vacinação em dia.",
    ],
    physical_exam: [
      "Bom estado geral, corado, hidratado, afebril. PA 120x80 mmHg, FC 72 bpm. Ausculta cardiopulmonar sem alterações. Abdome flácido, indolor.",
      "Bom estado geral. PA 130x85 mmHg, FC 78 bpm, SatO2 98%. Orofaringe sem hiperemia. Ausculta pulmonar limpa.",
      "Eupneico, acianótico, anictérico. PA 118x76 mmHg. Sem linfonodomegalias palpáveis.",
    ],
    assessment: [
      "Quadro compatível com fadiga associada a privação de sono e estresse ocupacional. Sem sinais de organicidade no momento.",
      "Cefaleia tensional episódica.",
      "Exames dentro dos parâmetros de normalidade. Paciente hígido.",
      "Infecção de via aérea superior, provável etiologia viral.",
    ],
    plan: [
      "Orientada higiene do sono e pausas regulares durante a jornada. Solicitados hemograma, TSH e ferritina. Retorno em 30 dias com resultados.",
      "Prescrito analgésico simples em caso de dor. Orientado registro de gatilhos em diário. Retorno em 45 dias.",
      "Mantidas orientações de dieta e atividade física. Próxima avaliação de rotina em 12 meses.",
      "Sintomáticos e hidratação. Orientados sinais de alarme para retorno imediato. Reavaliação se persistir além de sete dias.",
    ],
  },
  cardiologia: {
    chief_complaint: [
      "Palpitações ocasionais, principalmente em repouso.",
      "Retorno para ajuste de anti-hipertensivo.",
      "Avaliação pré-operatória para cirurgia eletiva.",
      "Dor torácica atípica ao esforço.",
      "Controle de dislipidemia.",
    ],
    anamnesis: [
      "Episódios de curta duração, autolimitados, sem síncope associada. Nega dor torácica ou dispneia. Consumo moderado de cafeína.",
      "Em uso regular da medicação, boa adesão. Aferições domiciliares com médias em torno de 140x90 mmHg. Nega efeitos adversos.",
      "Assintomático do ponto de vista cardiovascular. Boa capacidade funcional, sobe dois lances de escada sem limitação.",
      "Desconforto em queimação, sem irradiação, com resolução espontânea ao repouso. Histórico familiar positivo para coronariopatia precoce.",
    ],
    physical_exam: [
      "PA 128x82 mmHg, FC 68 bpm, ritmo regular em dois tempos, bulhas normofonéticas, sem sopros. Pulsos periféricos simétricos e cheios.",
      "PA 142x92 mmHg em duas aferições. Ritmo cardíaco regular, sem sopros. Ausência de edema em membros inferiores.",
      "PA 124x78 mmHg, FC 64 bpm. Ausculta cardíaca sem alterações. Estase jugular ausente.",
    ],
    assessment: [
      "Extrassistolia supraventricular benigna, sem repercussão hemodinâmica.",
      "Hipertensão arterial sistêmica com controle parcial.",
      "Risco cardiovascular perioperatório baixo.",
      "Dor torácica de características não anginosas. Necessária estratificação complementar.",
    ],
    plan: [
      "Orientada redução de cafeína e regularização do sono. Solicitado Holter 24h. Retorno com resultado.",
      "Ajustada dose do anti-hipertensivo. Reforçada restrição de sódio. Retorno em 60 dias com mapa de aferições domiciliares.",
      "Liberado para o procedimento sem restrições cardiológicas. Manter medicação habitual no perioperatório.",
      "Solicitados teste ergométrico e perfil lipídico. Retorno em 30 dias.",
    ],
  },
  dermatologia: {
    chief_complaint: [
      "Lesão avermelhada no antebraço há dois meses.",
      "Queda de cabelo difusa.",
      "Acne inflamatória em face.",
      "Prurido em região dorsal, sem lesão aparente.",
      "Revisão anual de nevos.",
    ],
    anamnesis: [
      "Lesão de crescimento lento, sem dor ou sangramento. Nega trauma local. Exposição solar ocupacional frequente, uso irregular de fotoprotetor.",
      "Início há cerca de quatro meses, sem áreas de alopecia cicatricial. Relata período de estresse intenso e dieta restritiva no mesmo intervalo.",
      "Quadro de longa data, com piora no último trimestre. Já utilizou tópicos sem orientação, com resposta parcial.",
      "Prurido de predomínio noturno. Nega contactantes com sintomas semelhantes. Pele seca ao longo de todo o inverno.",
    ],
    physical_exam: [
      "Placa eritematosa de bordas bem delimitadas, cerca de 2 cm, sem infiltração à palpação. Ausência de linfonodos regionais.",
      "Teste de tração positivo em vértice. Ausência de eritema ou descamação em couro cabeludo. Rarefação difusa, sem miniaturização evidente.",
      "Lesões inflamatórias pápulo-pustulosas em região malar bilateral, comedões abertos e fechados em zona T.",
      "Xerose difusa em tronco, com discreta descamação fina. Ausência de lesões primárias.",
    ],
    assessment: [
      "Lesão de aspecto benigno, provável dermatite crônica. Indicada dermatoscopia para confirmação.",
      "Eflúvio telógeno, provavelmente associado a estresse e restrição alimentar.",
      "Acne vulgar de grau moderado.",
      "Xerose cutânea com prurido secundário.",
    ],
    plan: [
      "Realizada dermatoscopia, sem critérios de malignidade. Prescrito tópico e fotoproteção diária. Reavaliação em 60 dias.",
      "Orientada normalização alimentar. Solicitados ferritina, TSH e hemograma. Retorno em 90 dias.",
      "Iniciado esquema tópico combinado. Orientada rotina de limpeza. Retorno em 60 dias para avaliar resposta.",
      "Prescrito emoliente de uso contínuo e orientações de banho. Retorno se persistência após quatro semanas.",
    ],
  },
};

const AI_MODEL = "claude-sonnet-4-6";

// ---------------------------------------------------------------------------
const admin = createClient(apiUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email === email);
    if (u) return u;
    if (data.users.length < 200) break;
  }
  return null;
}

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  const { rows: companyRows } = await client.query(
    "select name from myia_companies where id = $1", [COMPANY_ID]);
  if (!companyRows.length) throw new Error(`empresa ${COMPANY_ID} não existe`);
  console.log(`empresa: ${companyRows[0].name} (${COMPANY_ID})\n`);

  // ------------------------------------------------------------------ logins
  const vinculados = [];
  for (const p of LOGINS) {
    const professionalId = demoId(PREFIX_PROFESSIONAL, p.n);

    // O profissional tem de existir: a FK composta de 0018 exige (id, company_id).
    const { rows: existe } = await client.query(
      "select nome from myia_professionals_medical where id = $1 and company_id = $2",
      [professionalId, COMPANY_ID]);
    if (!existe.length) {
      throw new Error(
        `profissional ${professionalId} não existe nesta empresa. ` +
        `Rode antes: node scripts/seed-dashboard-demo.mjs ${COMPANY_ID}`);
    }

    // Discriminador da empresa no e-mail: sem ele o segundo tenant colidiria em
    // auth.users, que é global.
    const email = `${p.slug}.${COMPANY_TAG}@medico.teste`;

    let userId;
    const { data, error } = await admin.auth.admin.createUser({
      email, password: PASSWORD, email_confirm: true,
      user_metadata: { name: p.nome },
    });
    if (error) {
      const existing = await findUserByEmail(email);
      if (!existing) throw new Error(`falha criando ${email}: ${error.message}`);
      userId = existing.id;
      console.log(`  ${email.padEnd(30)} já existia`);
    } else {
      userId = data.user.id;
      console.log(`  ${email.padEnd(30)} criado`);
    }

    await client.query(
      `insert into myia_users (id, company_id, role, professional_id)
       values ($1, $2, 'professional', $3)
       on conflict (id) do update
         set company_id = excluded.company_id,
             role = excluded.role,
             professional_id = excluded.professional_id`,
      [userId, COMPANY_ID, professionalId]);

    vinculados.push({ ...p, professionalId, userId, email });
  }

  // ------------------------------------------------------------- prontuários
  await client.query("begin");

  await client.query(
    "delete from myia_medical_records where id::text like $1 and company_id = $2",
    [demoLike(PREFIX_RECORD), COMPANY_ID]);

  // Prontuário e login são coisas INDEPENDENTES: a IA escreve o registro tenha
  // o médico acesso ao sistema ou não. Por isso a geração percorre CANDIDATOS,
  // não `vinculados` — reduzir o número de logins não pode apagar o prontuário
  // de quem ficou sem conta.
  const comProntuario = CANDIDATOS.map((p) => ({
    ...p,
    professionalId: demoId(PREFIX_PROFESSIONAL, p.n),
  }));

  // `order by a.id` é obrigatório: sem ordem estável o PRNG casa um texto
  // diferente a cada execução e a idempotência morre.
  const { rows: atendimentos } = await client.query(
    `select a.id, a.appointment_date, a.client_id, a.professional_id
     from myia_appointments a
     where a.company_id = $1 and a.status = 'completed'
       and a.professional_id = any($2)
     order by a.id`,
    [COMPANY_ID, comProntuario.map((v) => v.professionalId)]);

  const areaPorProfissional = Object.fromEntries(
    comProntuario.map((v) => [v.professionalId, v.area]));

  let n = 0;
  const contagem = { ai: 0, manual: 0, pending: 0, reviewed: 0, signed: 0 };

  for (const a of atendimentos) {
    const lib = TEXTOS[areaPorProfissional[a.professional_id]];

    const source = rand() < 0.8 ? "ai" : "manual";
    const r = rand();
    const review = r < 0.55 ? "signed" : r < 0.80 ? "reviewed" : "pending";
    contagem[source]++; contagem[review]++;

    const geradoEm = new Date(`${a.appointment_date.toISOString().slice(0, 10)}T12:00:00Z`);
    geradoEm.setMinutes(geradoEm.getMinutes() + between(2, 15));

    const revisadoEm = review === "pending" ? null
      : new Date(geradoEm.getTime() + between(30, 2880) * 60000);
    const assinadoEm = review === "signed"
      ? new Date(revisadoEm.getTime() + between(5, 600) * 60000) : null;

    await client.query(
      `insert into myia_medical_records
        (id, company_id, appointment_id, professional_id, contact_id, record_date,
         chief_complaint, anamnesis, physical_exam, assessment, plan,
         source, ai_model, ai_generated_at, review_status, reviewed_at, signed_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        demoId(PREFIX_RECORD, ++n), COMPANY_ID, a.id, a.professional_id, a.client_id,
        a.appointment_date,
        pick(lib.chief_complaint), pick(lib.anamnesis), pick(lib.physical_exam),
        pick(lib.assessment), pick(lib.plan),
        source,
        source === "ai" ? AI_MODEL : null,
        source === "ai" ? geradoEm.toISOString() : null,
        review,
        revisadoEm ? revisadoEm.toISOString() : null,
        assinadoEm ? assinadoEm.toISOString() : null,
      ]);
  }

  await client.query("commit");

  console.log(`
logins de médico ..... ${vinculados.length}
prontuários .......... ${n}
  por IA / manual .... ${contagem.ai} / ${contagem.manual}
  aguardando ......... ${contagem.pending}
  revisados .......... ${contagem.reviewed}
  assinados .......... ${contagem.signed}

acesso (senha ${PASSWORD}):`);
  for (const v of vinculados) console.log(`  ${v.email.padEnd(30)} ${v.nome}`);
} catch (err) {
  await client.query("rollback").catch(() => {});
  console.error("ROLLBACK —", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
