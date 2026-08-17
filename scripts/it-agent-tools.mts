#!/usr/bin/env node --experimental-strip-types
/**
 * Teste de integração das tools do agente — Plano 3, P3.3.
 * Uso: npm run test:integration:tools
 *
 * Prova o invariante mais importante do Plano 3: **uma tool nunca devolve dado
 * de outro tenant**. Monta DUAS clínicas com dados parecidos, constrói as tools
 * no contexto da clínica A e tenta, de todas as formas que o modelo teria à
 * disposição, alcançar dado da clínica B.
 *
 * Também prova o cálculo de disponibilidade, que é onde um erro vira horário
 * oferecido a paciente e depois desmarcado.
 *
 * Escreve no banco e limpa no fim, inclusive em caso de falha.
 */

import { readFileSync, existsSync } from "node:fs"
import { randomUUID } from "node:crypto"

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}

const { supabaseServer } = await import("../worker/supabase.mts")
const { buildReadTools, buildWriteTools, buildEscalationTools } = await import(
  "../worker/tools.mts"
)

const A = {
  company: randomUUID(),
  service: randomUUID(),
  prof: randomUUID(),
  contact: randomUUID(),
  chat: randomUUID(),
}
const B = {
  company: randomUUID(),
  service: randomUUID(),
  prof: randomUUID(),
  contact: randomUUID(),
  chat: randomUUID(),
}

let failures = 0

function check(ok: boolean, label: string) {
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}`)
  if (!ok) failures++
}

/** Próxima data futura com o weekday ISO pedido, em AAAA-MM-DD. */
function nextDateForWeekday(iso: number): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  for (let i = 1; i <= 14; i++) {
    const c = new Date(d.getTime() + i * 86_400_000)
    const day = c.getUTCDay() === 0 ? 7 : c.getUTCDay()
    if (day === iso) return c.toISOString().slice(0, 10)
  }
  throw new Error("weekday não encontrado")
}

const TARGET_WEEKDAY = 3 // quarta
const TARGET_DATE = nextDateForWeekday(TARGET_WEEKDAY)

async function seed(t: typeof A, nome: string, weekday: number) {
  await supabaseServer.from("myia_companies").insert([{ id: t.company, name: nome }])

  await supabaseServer.from("myia_services").insert([
    {
      id: t.service,
      company_id: t.company,
      name: `Consulta ${nome}`,
      price: 200,
      tempo_medio: "30 min",
      available: true,
    },
  ])

  await supabaseServer.from("myia_professionals_medical").insert([
    {
      id: t.prof,
      company_id: t.company,
      nome: `Dr. ${nome}`,
      especialidade: "Clínica Geral",
      registro: `CRM-${nome}`,
    },
  ])

  await supabaseServer.from("myia_company_agreements").insert([
    { company_id: t.company, name: `Convênio ${nome}`, status: true },
  ])

  await supabaseServer.from("myia_professional_availability").insert([
    {
      professional_id: t.prof,
      service_id: t.service,
      weekday,
      start_time: "09:00:00",
      end_time: "11:00:00",
      max_simultaneous_clients: 1,
    },
  ])

  await supabaseServer.from("myia_contacts").insert([
    {
      id: t.contact,
      company_id: t.company,
      name: `Paciente ${nome}`,
      number: `5511${nome === "A" ? "1111" : "2222"}11111`,
      remote_jid: `55111111111${nome === "A" ? 1 : 2}@s.whatsapp.net`,
    },
  ])

  await supabaseServer.from("myia_chat").insert([
    {
      id: t.chat,
      company_id: t.company,
      contact_id: t.contact,
      instance_id: `inst-${nome}`,
    },
  ])
}

async function cleanup() {
  for (const t of [A, B]) {
    await supabaseServer.from("myia_appointments").delete().eq("company_id", t.company)
    await supabaseServer.from("myia_professional_availability").delete().eq("service_id", t.service)
    await supabaseServer.from("myia_chat").delete().eq("id", t.chat)
    await supabaseServer.from("myia_contacts").delete().eq("id", t.contact)
    await supabaseServer.from("myia_professionals_medical").delete().eq("id", t.prof)
    await supabaseServer.from("myia_services").delete().eq("id", t.service)
    await supabaseServer.from("myia_company_agreements").delete().eq("company_id", t.company)
    await supabaseServer.from("myia_companies").delete().eq("id", t.company)
  }
}

/** Roda a tool pelo nome e devolve o JSON já parseado. */
async function call(tools: any[], name: string, args: unknown) {
  const tool = tools.find((t: any) => t.name === name)
  if (!tool) throw new Error(`tool ${name} não existe`)
  return JSON.parse(await (tool as any).run(args))
}

try {
  console.log("\n# fixtures: duas clínicas com dados equivalentes")
  await seed(A, "A", TARGET_WEEKDAY)
  await seed(B, "B", TARGET_WEEKDAY)
  console.log(`  criadas (data alvo: ${TARGET_DATE})`)

  // Contexto da clínica A. O `record` é no-op: gravar tool_calls exigiria um run.
  const tools = buildReadTools({
    companyId: A.company,
    chatId: A.chat,
    record: async () => {},
  })

  // -------------------------------------------------------------------------
  console.log("\n# isolamento: as tools só enxergam a clínica do contexto")

  const servicos = await call(tools, "buscar_servicos", {})
  check(servicos.length === 1, `1 serviço (veio ${servicos.length})`)
  check(servicos[0]?.nome === "Consulta A", "serviço é o da clínica A")

  const profs = await call(tools, "listar_profissionais", {})
  check(profs.length === 1 && profs[0]?.nome === "Dr. A", "profissional é o da clínica A")

  const convenios = await call(tools, "consultar_convenios", {})
  check(
    convenios.length === 1 && convenios[0]?.nome === "Convênio A",
    "convênio é o da clínica A",
  )

  // Mesmo buscando pelo NOME do dado da clínica B, nada vaza.
  const buscaB = await call(tools, "buscar_servicos", { termo: "Consulta B" })
  check(buscaB.length === 0, "busca pelo nome do serviço de B não devolve nada")

  const profB = await call(tools, "listar_profissionais", { especialidade: "Clínica Geral" })
  check(
    profB.every((p: any) => p.nome !== "Dr. B"),
    "filtro amplo de especialidade não traz profissional de B",
  )

  // -------------------------------------------------------------------------
  console.log("\n# isolamento: id de outro tenant é rejeitado, não silenciado")

  const disponB = await call(tools, "consultar_disponibilidade", {
    service_id: B.service,
    data_inicio: TARGET_DATE,
    data_fim: TARGET_DATE,
  })
  check(
    typeof disponB.erro === "string",
    `service_id de B é recusado (veio ${JSON.stringify(disponB).slice(0, 60)})`,
  )

  const disponProfB = await call(tools, "consultar_disponibilidade", {
    service_id: A.service,
    professional_id: B.prof,
    data_inicio: TARGET_DATE,
    data_fim: TARGET_DATE,
  })
  check(
    Array.isArray(disponProfB.horarios) && disponProfB.horarios.length === 0,
    "professional_id de B não devolve agenda",
  )

  // -------------------------------------------------------------------------
  console.log("\n# identificar_paciente: preso ao chat, sem parâmetro")

  const paciente = await call(tools, "identificar_paciente", {})
  check(paciente.cadastrado === true, "paciente do chat encontrado")
  check(paciente.nome === "Paciente A", "é o paciente da clínica A")

  const toolsWrongChat = buildReadTools({
    companyId: A.company,
    chatId: B.chat, // chat de outra clínica
    record: async () => {},
  })
  const pacienteB = await call(toolsWrongChat, "identificar_paciente", {})
  check(
    typeof pacienteB.erro === "string",
    "chat de outra clínica é recusado",
  )

  // -------------------------------------------------------------------------
  console.log("\n# disponibilidade: cálculo dos slots")

  const dispon = await call(tools, "consultar_disponibilidade", {
    service_id: A.service,
    data_inicio: TARGET_DATE,
    data_fim: TARGET_DATE,
  })

  // 09:00–11:00 com 30 min = 4 slots.
  check(
    dispon.horarios?.length === 4,
    `4 slots em 09:00-11:00/30min (veio ${dispon.horarios?.length})`,
  )
  check(dispon.horarios?.[0]?.horario === "09:00", "primeiro slot 09:00")
  check(dispon.horarios?.[3]?.horario === "10:30", "último slot 10:30")
  check(dispon.duracao_minutos === 30, "duração lida de tempo_medio")

  // Agendamento existente tem que sumir da lista.
  await supabaseServer.from("myia_appointments").insert([
    {
      company_id: A.company,
      professional_id: A.prof,
      service_id: A.service,
      client_id: A.contact,
      appointment_date: TARGET_DATE,
      start_time: "09:30:00",
      end_time: "10:00:00",
      status: "scheduled",
    },
  ])

  const depois = await call(tools, "consultar_disponibilidade", {
    service_id: A.service,
    data_inicio: TARGET_DATE,
    data_fim: TARGET_DATE,
  })

  check(depois.horarios?.length === 3, `slot ocupado sai da lista (${depois.horarios?.length})`)
  check(
    !depois.horarios?.some((h: any) => h.horario === "09:30"),
    "09:30 não é mais oferecido",
  )

  // Cancelado libera o horário de volta.
  await supabaseServer
    .from("myia_appointments")
    .update({ status: "cancelled" })
    .eq("company_id", A.company)

  const cancelado = await call(tools, "consultar_disponibilidade", {
    service_id: A.service,
    data_inicio: TARGET_DATE,
    data_fim: TARGET_DATE,
  })
  check(cancelado.horarios?.length === 4, "cancelamento devolve o horário")

  // -------------------------------------------------------------------------
  console.log("\n# limites de entrada")

  const semRegra = await call(tools, "consultar_disponibilidade", {
    service_id: A.service,
    // Dia sem regra de disponibilidade cadastrada.
    data_inicio: nextDateForWeekday(TARGET_WEEKDAY === 7 ? 1 : TARGET_WEEKDAY + 1),
    data_fim: nextDateForWeekday(TARGET_WEEKDAY === 7 ? 1 : TARGET_WEEKDAY + 1),
  })
  check(semRegra.horarios?.length === 0, "dia sem regra não gera slot")

  // ===========================================================================
  // ESCRITA (P3.4) — a partir daqui o agente mexe na agenda de verdade.
  // ===========================================================================
  const escrita = buildWriteTools({
    companyId: A.company,
    chatId: A.chat,
    record: async () => {},
  })

  console.log("\n# agendar: o caminho feliz")

  const marcado = await call(escrita, "agendar_consulta", {
    service_id: A.service,
    professional_id: A.prof,
    data: TARGET_DATE,
    horario: "10:00",
  })
  check(marcado.agendado === true, `10:00 foi marcado (${JSON.stringify(marcado).slice(0, 80)})`)
  check(marcado.duracao_minutos === 30, "duração veio do serviço, não do parâmetro")

  // O agendamento tem de sair do dono do CHAT, nunca de um parâmetro.
  const { data: criado } = await supabaseServer
    .from("myia_appointments")
    .select("client_id, cliente_telefone, end_time, status")
    .eq("id", marcado.id)
    .single()
  check(criado?.client_id === A.contact, "client_id é o dono do chat")
  check(String(criado?.end_time).startsWith("10:30"), "fim calculado a partir da duração")

  const sumiu = await call(tools, "consultar_disponibilidade", {
    service_id: A.service,
    data_inicio: TARGET_DATE,
    data_fim: TARGET_DATE,
  })
  check(
    !sumiu.horarios?.some((h: any) => h.horario === "10:00"),
    "o horário marcado sai da disponibilidade",
  )

  console.log("\n# agendar: o que tem de ser recusado")

  // O gatilho de 0029. É a garantia que impede duas pessoas na mesma cadeira.
  const colisao = await call(escrita, "agendar_consulta", {
    service_id: A.service,
    professional_id: A.prof,
    data: TARGET_DATE,
    horario: "10:00",
  })
  // Não basta recusar: o motivo tem de chegar ao modelo em palavras que ele
  // possa repetir ao paciente. Um "duplicate key violates constraint" vazando
  // para o WhatsApp é tão ruim quanto marcar duas vezes.
  check(
    typeof colisao.erro === "string" && /ocupado/i.test(colisao.detalhe ?? ""),
    `horário já ocupado é recusado com motivo legível (gatilho 0029) — veio: ${colisao.detalhe}`,
  )

  const foraDoExpediente = await call(escrita, "agendar_consulta", {
    service_id: A.service,
    professional_id: A.prof,
    data: TARGET_DATE,
    horario: "14:00", // a agenda é 09:00–11:00
  })
  check(typeof foraDoExpediente.erro === "string", "horário fora da janela é recusado")

  const passado = await call(escrita, "agendar_consulta", {
    service_id: A.service,
    professional_id: A.prof,
    data: "2020-01-01",
    horario: "09:00",
  })
  check(typeof passado.erro === "string", "data no passado é recusada")

  const servicoDeB = await call(escrita, "agendar_consulta", {
    service_id: B.service,
    professional_id: A.prof,
    data: TARGET_DATE,
    horario: "09:00",
  })
  check(typeof servicoDeB.erro === "string", "service_id de outra clínica é recusado")

  const profDeB = await call(escrita, "agendar_consulta", {
    service_id: A.service,
    professional_id: B.prof,
    data: TARGET_DATE,
    horario: "09:00",
  })
  check(typeof profDeB.erro === "string", "professional_id de outra clínica é recusado")

  console.log("\n# remarcar e cancelar: só a consulta do dono do chat")

  // Consulta pertencente ao paciente da OUTRA clínica. É o alvo que um id
  // vazado ou alucinado teria — e o que não pode ser tocado.
  const { data: alheia } = await supabaseServer
    .from("myia_appointments")
    .insert({
      company_id: B.company,
      professional_id: B.prof,
      service_id: B.service,
      client_id: B.contact,
      appointment_date: TARGET_DATE,
      start_time: "09:00:00",
      end_time: "09:30:00",
      status: "scheduled",
    })
    .select("id")
    .single()

  const remarcarAlheia = await call(escrita, "remarcar_consulta", {
    appointment_id: alheia!.id,
    data: TARGET_DATE,
    horario: "09:30",
  })
  check(typeof remarcarAlheia.erro === "string", "remarcar consulta de outro paciente é recusado")

  const cancelarAlheia = await call(escrita, "cancelar_consulta", {
    appointment_id: alheia!.id,
  })
  check(typeof cancelarAlheia.erro === "string", "cancelar consulta de outro paciente é recusado")

  const { data: intacta } = await supabaseServer
    .from("myia_appointments")
    .select("status, start_time")
    .eq("id", alheia!.id)
    .single()
  check(
    intacta?.status === "scheduled" && String(intacta.start_time).startsWith("09:00"),
    "a consulta alheia continua intacta",
  )

  const remarcado = await call(escrita, "remarcar_consulta", {
    appointment_id: marcado.id,
    data: TARGET_DATE,
    horario: "09:00",
  })
  check(remarcado.remarcado === true, `remarcar 10:00 -> 09:00 (${JSON.stringify(remarcado).slice(0, 80)})`)

  const voltou = await call(tools, "consultar_disponibilidade", {
    service_id: A.service,
    data_inicio: TARGET_DATE,
    data_fim: TARGET_DATE,
  })
  check(
    voltou.horarios?.some((h: any) => h.horario === "10:00") &&
      !voltou.horarios?.some((h: any) => h.horario === "09:00"),
    "remarcar devolve o horário antigo e ocupa o novo",
  )

  const cancelado2 = await call(escrita, "cancelar_consulta", {
    appointment_id: marcado.id,
    motivo: "imprevisto",
  })
  check(cancelado2.cancelado === true, "cancelar a própria consulta funciona")

  const livre = await call(tools, "consultar_disponibilidade", {
    service_id: A.service,
    data_inicio: TARGET_DATE,
    data_fim: TARGET_DATE,
  })
  check(livre.horarios?.length === 4, `cancelamento devolve todos os slots (${livre.horarios?.length})`)

  console.log("\n# escalonamento (P3.5)")

  const escalonamento = buildEscalationTools({
    companyId: A.company,
    chatId: A.chat,
    record: async () => {},
  })

  const transferido = await call(escalonamento, "transferir_para_humano", {
    motivo: "paciente pediu para falar com alguém",
    urgente: false,
  })
  check(transferido.transferido === true, "transferir_para_humano responde ok")

  const { data: chatPausado } = await supabaseServer
    .from("myia_chat")
    .select("chat_pause")
    .eq("id", A.chat)
    .single()
  check(chatPausado?.chat_pause === true, "chat_pause ligado — o worker para de responder")

  const escalonamentoB = buildEscalationTools({
    companyId: A.company,
    chatId: B.chat,
    record: async () => {},
  })
  const transferirB = await call(escalonamentoB, "transferir_para_humano", { motivo: "x" })
  check(typeof transferirB.erro === "string", "não dá para pausar chat de outra clínica")
} finally {
  console.log("\n# limpeza")
  await cleanup()
  console.log("  removidas")
}

console.log(failures === 0 ? "\nPASS" : `\nFAIL — ${failures} asserção(ões)`)
process.exit(failures === 0 ? 0 : 1)
