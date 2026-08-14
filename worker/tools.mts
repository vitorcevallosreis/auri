import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema"
import { supabaseServer } from "./supabase.mts"

/**
 * Superfície de tools do agente.
 *
 * `buildReadTools` (P3.3) consulta catálogo, cadastro e agenda.
 * `buildWriteTools` (P3.4) marca, remarca e cancela.
 * `buildEscalationTools` (P3.5) devolve a conversa a um humano.
 *
 * ⚠️ INVARIANTE DE SEGURANÇA: `company_id` NÃO é parâmetro de nenhuma tool.
 * Ele é capturado por closure a partir do canal que recebeu a mensagem. O
 * modelo não consegue nem pedir dado de outro tenant — não existe campo no
 * schema para isso. Um `company_id` vindo do modelo seria vazamento
 * cross-tenant esperando acontecer, e é a razão de as tools serem construídas
 * por turno em vez de definidas no módulo.
 *
 * Mesma lógica em `identificar_paciente`: não aceita número. O paciente é o
 * dono do chat. Sem isso, o modelo poderia ser induzido a consultar o cadastro
 * de terceiros ("meu marido é paciente de vocês, qual o telefone dele?").
 */

export interface ToolContext {
  companyId: string
  chatId: string
  /** Registra a chamada em myia_agent_tool_calls. */
  record: (
    toolName: string,
    input: unknown,
    output: unknown,
    isError: boolean,
    durationMs: number,
  ) => Promise<void>
}

/** Envolve a execução para registrar entrada, saída, erro e duração. */
async function traced<T>(
  ctx: ToolContext,
  name: string,
  input: unknown,
  fn: () => Promise<T>,
): Promise<string> {
  const startedAt = Date.now()
  try {
    const result = await fn()
    const json = JSON.stringify(result)
    await ctx.record(name, input, result, false, Date.now() - startedAt)
    return json
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await ctx.record(name, input, { error: message }, true, Date.now() - startedAt)

    // Devolve o erro COMO RESULTADO, não como exceção: o tool runner mostra ao
    // modelo, que renegocia com o paciente. Lançar aqui abortaria o turno
    // inteiro por causa de uma consulta que falhou.
    //
    // `erro` é genérico de propósito — quem explica é `detalhe`, e é dele que o
    // modelo tira o que dizer ao paciente ("esse horário acabou de ser
    // ocupado"). Uma frase fixa dizendo "não foi possível consultar" mentiria
    // sobre as tools de escrita, que não consultam nada.
    return JSON.stringify({
      erro: "a operação não foi concluída",
      detalhe: message,
    })
  }
}

// ---------------------------------------------------------------------------
// Duração do serviço
// ---------------------------------------------------------------------------
/**
 * `myia_services.tempo_medio` é TEXT livre ("30 min", "1h", "45"). Sem um campo
 * numérico não dá para calcular slot com precisão, então extraímos o primeiro
 * número e tratamos "h"/"hora" como horas.
 *
 * Dívida de schema conhecida: o certo é uma coluna `duration_minutes integer`.
 * Enquanto ela não existe, este parser é o contrato — e o default de 30 min
 * evita gerar slot de duração zero, que produziria agenda infinita.
 */
export function parseDurationMinutes(tempoMedio: string | null): number {
  if (!tempoMedio) return 30

  const text = tempoMedio.toLowerCase().trim()
  const match = text.match(/(\d+([.,]\d+)?)/)
  if (!match) return 30

  const value = Number(match[1].replace(",", "."))
  if (!Number.isFinite(value) || value <= 0) return 30

  const isHours = /h(ora)?/.test(text) && !/min/.test(text)
  const minutes = Math.round(isHours ? value * 60 : value)

  return Math.min(Math.max(minutes, 5), 8 * 60)
}

// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------

function toMinutes(hhmmss: string): number {
  const [h, m] = hhmmss.split(":")
  return Number(h) * 60 + Number(m)
}

function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** ISO weekday: 1=segunda … 7=domingo, como a migration 0006 define. */
function isoWeekday(date: Date): number {
  const day = date.getUTCDay()
  return day === 0 ? 7 : day
}

function eachDate(fromISO: string, toISO: string, maxDays: number): string[] {
  const out: string[] = []
  const start = new Date(`${fromISO}T00:00:00Z`)
  const end = new Date(`${toISO}T00:00:00Z`)

  for (
    let d = start;
    d <= end && out.length < maxDays;
    d = new Date(d.getTime() + 86_400_000)
  ) {
    out.push(d.toISOString().slice(0, 10))
  }

  return out
}

// ---------------------------------------------------------------------------
// Fábrica
// ---------------------------------------------------------------------------

export function buildReadTools(ctx: ToolContext) {
  const buscar_servicos = betaTool({
    name: "buscar_servicos",
    description:
      "Lista os serviços/procedimentos oferecidos pela clínica, com preço e duração. Use sempre que o paciente perguntar o que a clínica faz, quanto custa ou quanto tempo demora. Filtre por termo quando o paciente citar algo específico.",
    inputSchema: {
      type: "object",
      properties: {
        termo: {
          type: "string",
          description:
            "Parte do nome do serviço. Omita para listar todos os disponíveis.",
        },
      },
      additionalProperties: false,
    },
    run: async (args) =>
      traced(ctx, "buscar_servicos", args, async () => {
        let query = supabaseServer
          .from("myia_services")
          .select("id, name, price, description, tempo_medio, aceita_convenio")
          .eq("company_id", ctx.companyId)
          .eq("available", true)
          .order("name", { ascending: true })
          .limit(50)

        if (args.termo) query = query.ilike("name", `%${args.termo}%`)

        const { data, error } = await query
        if (error) throw new Error(error.message)

        return (data ?? []).map((s) => ({
          id: s.id,
          nome: s.name,
          preco: Number(s.price),
          descricao: s.description,
          duracao_minutos: parseDurationMinutes(s.tempo_medio),
          aceita_convenio: s.aceita_convenio,
        }))
      }),
  })

  const listar_profissionais = betaTool({
    name: "listar_profissionais",
    description:
      "Lista os profissionais da clínica com especialidade e registro. Use quando o paciente perguntar quem atende, ou para escolher um profissional antes de consultar horários.",
    inputSchema: {
      type: "object",
      properties: {
        especialidade: {
          type: "string",
          description: "Filtra por especialidade. Omita para listar todos.",
        },
      },
      additionalProperties: false,
    },
    run: async (args) =>
      traced(ctx, "listar_profissionais", args, async () => {
        let query = supabaseServer
          .from("myia_professionals_medical")
          .select("id, nome, formacao, especialidade, registro, convenios_aceitos")
          .eq("company_id", ctx.companyId)
          .order("nome", { ascending: true })
          .limit(50)

        if (args.especialidade) {
          query = query.ilike("especialidade", `%${args.especialidade}%`)
        }

        const { data, error } = await query
        if (error) throw new Error(error.message)

        return (data ?? []).map((p) => ({
          id: p.id,
          nome: p.nome,
          formacao: p.formacao,
          especialidade: p.especialidade,
          registro: p.registro,
          convenios_aceitos: p.convenios_aceitos,
        }))
      }),
  })

  const consultar_convenios = betaTool({
    name: "consultar_convenios",
    description:
      "Lista os convênios aceitos pela clínica. Use quando o paciente perguntar se a clínica atende o plano dele.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: async (args) =>
      traced(ctx, "consultar_convenios", args, async () => {
        const { data, error } = await supabaseServer
          .from("myia_company_agreements")
          .select("name, description")
          .eq("company_id", ctx.companyId)
          .eq("status", true)
          .order("name", { ascending: true })

        if (error) throw new Error(error.message)

        return (data ?? []).map((c) => ({
          nome: c.name,
          observacao: c.description,
        }))
      }),
  })

  const identificar_paciente = betaTool({
    name: "identificar_paciente",
    description:
      "Retorna o cadastro do paciente com quem você está conversando agora, e o histórico de agendamentos dele. Use no início do atendimento para saber se já é conhecido.",
    // Sem parâmetros DE PROPÓSITO: o paciente é o dono deste chat. Aceitar
    // número ou nome permitiria consultar cadastro de terceiros.
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: async (args) =>
      traced(ctx, "identificar_paciente", args, async () => {
        const { data: chat, error: chatErr } = await supabaseServer
          .from("myia_chat")
          .select("contact_id, company_id")
          .eq("id", ctx.chatId)
          .maybeSingle()

        if (chatErr) throw new Error(chatErr.message)
        if (!chat || chat.company_id !== ctx.companyId) {
          throw new Error("chat não pertence a esta clínica")
        }
        if (!chat.contact_id) return { cadastrado: false }

        const { data: contact } = await supabaseServer
          .from("myia_contacts")
          .select("id, name, number")
          .eq("id", chat.contact_id)
          .eq("company_id", ctx.companyId)
          .maybeSingle()

        if (!contact) return { cadastrado: false }

        const { data: appointments } = await supabaseServer
          .from("myia_appointments")
          .select("id, appointment_date, start_time, status, service_id, professional_id")
          .eq("company_id", ctx.companyId)
          .eq("client_id", contact.id)
          .order("appointment_date", { ascending: false })
          .limit(10)

        return {
          cadastrado: true,
          id: contact.id,
          nome: contact.name,
          telefone: contact.number,
          agendamentos: (appointments ?? []).map((ap) => ({
            id: ap.id,
            data: ap.appointment_date,
            horario: String(ap.start_time).slice(0, 5),
            status: ap.status,
            service_id: ap.service_id,
            professional_id: ap.professional_id,
          })),
        }
      }),
  })

  const consultar_disponibilidade = betaTool({
    name: "consultar_disponibilidade",
    description:
      "Retorna os horários livres para um serviço, opcionalmente com um profissional específico, num intervalo de datas. Use SEMPRE antes de oferecer horário ao paciente — nunca invente disponibilidade.",
    inputSchema: {
      type: "object",
      properties: {
        service_id: {
          type: "string",
          description: "id do serviço, obtido em buscar_servicos",
        },
        professional_id: {
          type: "string",
          description:
            "id do profissional, obtido em listar_profissionais. Omita para ver todos que atendem esse serviço.",
        },
        data_inicio: {
          type: "string",
          description: "Primeira data do intervalo, no formato AAAA-MM-DD",
        },
        data_fim: {
          type: "string",
          description:
            "Última data do intervalo, AAAA-MM-DD. Máximo de 14 dias a partir de data_inicio.",
        },
      },
      required: ["service_id", "data_inicio", "data_fim"],
      additionalProperties: false,
    },
    run: async (args) =>
      traced(ctx, "consultar_disponibilidade", args, async () => {
        // Confere que o serviço é DESTA clínica antes de qualquer join — sem
        // isso, um service_id de outro tenant vazaria a agenda dele.
        const { data: service, error: svcErr } = await supabaseServer
          .from("myia_services")
          .select("id, name, tempo_medio, company_id")
          .eq("id", args.service_id)
          .eq("company_id", ctx.companyId)
          .maybeSingle()

        if (svcErr) throw new Error(svcErr.message)
        if (!service) throw new Error("serviço não encontrado nesta clínica")

        const duration = parseDurationMinutes(service.tempo_medio)
        const dates = eachDate(args.data_inicio, args.data_fim, 14)
        if (dates.length === 0) throw new Error("intervalo de datas inválido")

        // Profissionais desta clínica (filtro de tenant explícito).
        let profQuery = supabaseServer
          .from("myia_professionals_medical")
          .select("id, nome")
          .eq("company_id", ctx.companyId)

        if (args.professional_id) {
          profQuery = profQuery.eq("id", args.professional_id)
        }

        const { data: professionals, error: profErr } = await profQuery
        if (profErr) throw new Error(profErr.message)
        if (!professionals?.length) {
          return { servico: service.name, duracao_minutos: duration, horarios: [] }
        }

        const profIds = professionals.map((p) => p.id)
        const profName = new Map(professionals.map((p) => [p.id, p.nome]))

        const { data: availability, error: availErr } = await supabaseServer
          .from("myia_professional_availability")
          .select("professional_id, weekday, start_time, end_time, max_simultaneous_clients")
          .eq("service_id", service.id)
          .in("professional_id", profIds)

        if (availErr) throw new Error(availErr.message)
        if (!availability?.length) {
          return { servico: service.name, duracao_minutos: duration, horarios: [] }
        }

        const { data: booked, error: bookErr } = await supabaseServer
          .from("myia_appointments")
          .select("professional_id, appointment_date, start_time, end_time")
          .eq("company_id", ctx.companyId)
          .in("professional_id", profIds)
          .gte("appointment_date", dates[0])
          .lte("appointment_date", dates[dates.length - 1])
          // Cancelado libera o horário; os demais status ocupam.
          .neq("status", "cancelled")

        if (bookErr) throw new Error(bookErr.message)

        // Índice de ocupação: chave "profissional|data" -> intervalos ocupados.
        const busy = new Map<string, Array<{ from: number; to: number }>>()
        for (const ap of booked ?? []) {
          const key = `${ap.professional_id}|${ap.appointment_date}`
          const list = busy.get(key) ?? []
          list.push({
            from: toMinutes(String(ap.start_time)),
            to: toMinutes(String(ap.end_time)),
          })
          busy.set(key, list)
        }

        const slots: Array<{
          data: string
          horario: string
          professional_id: string
          profissional: string
        }> = []

        for (const date of dates) {
          const weekday = isoWeekday(new Date(`${date}T00:00:00Z`))

          for (const rule of availability) {
            if (rule.weekday !== weekday) continue

            const capacity = rule.max_simultaneous_clients ?? 1
            const key = `${rule.professional_id}|${date}`
            const taken = busy.get(key) ?? []

            const from = toMinutes(String(rule.start_time))
            const to = toMinutes(String(rule.end_time))

            for (let t = from; t + duration <= to; t += duration) {
              const overlapping = taken.filter(
                (b) => b.from < t + duration && t < b.to,
              ).length

              if (overlapping >= capacity) continue

              slots.push({
                data: date,
                horario: toHHMM(t),
                professional_id: rule.professional_id,
                profissional: profName.get(rule.professional_id) ?? "",
              })
            }
          }
        }

        // Ordena para a resposta ser estável e o modelo oferecer o mais próximo.
        slots.sort(
          (a, b) =>
            a.data.localeCompare(b.data) ||
            a.horario.localeCompare(b.horario) ||
            a.profissional.localeCompare(b.profissional),
        )

        return {
          servico: service.name,
          duracao_minutos: duration,
          // Teto para não estourar o contexto num intervalo largo.
          horarios: slots.slice(0, 60),
          total_encontrado: slots.length,
        }
      }),
  })

  return [
    buscar_servicos,
    listar_profissionais,
    consultar_convenios,
    identificar_paciente,
    consultar_disponibilidade,
  ]
}

// ---------------------------------------------------------------------------
// Escrita (P3.4)
// ---------------------------------------------------------------------------
/**
 * As três tools que mexem na agenda: marcar, remarcar e cancelar.
 *
 * ⚠️ A REGRA QUE ATRAVESSA AS TRÊS: o paciente é o dono do chat.
 *
 * Nenhuma delas aceita telefone, nome de paciente ou `client_id` como
 * parâmetro para escolher DE QUEM é o agendamento — sai sempre do
 * `myia_chat.contact_id` do chat corrente, pela mesma razão que
 * `identificar_paciente` não aceita nada. `remarcar` e `cancelar` recebem um
 * `appointment_id`, e por isso CONFEREM que ele é do dono deste chat antes de
 * tocar em qualquer coisa: um id vazado, adivinhado ou alucinado não pode virar
 * "cancelei a consulta de outra pessoa".
 *
 * A garantia de que dois pacientes não ocupam o mesmo horário NÃO está aqui —
 * está no gatilho de capacidade da migration 0029, que roda dentro da mesma
 * transação do INSERT e serializa por (profissional, data). O que está aqui é a
 * outra metade, a que o banco deliberadamente não faz: o agente só marca dentro
 * da janela que a clínica publicou. Encaixe fora do expediente é decisão da
 * recepcionista; o agente não tem essa autoridade.
 */

/** Erro do gatilho 0029. Nome no lugar do código solto espalhado pelo arquivo. */
const CAPACIDADE_ESGOTADA = "23P01"

interface DonoDoChat {
  contactId: string | null
  nome: string | null
  telefone: string | null
}

/** Quem está do outro lado deste chat. Uma consulta, usada pelas três tools. */
async function donoDoChat(ctx: ToolContext): Promise<DonoDoChat> {
  const { data: chat, error } = await supabaseServer
    .from("myia_chat")
    .select("contact_id, company_id")
    .eq("id", ctx.chatId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!chat || chat.company_id !== ctx.companyId) {
    throw new Error("chat não pertence a esta clínica")
  }
  if (!chat.contact_id) return { contactId: null, nome: null, telefone: null }

  const { data: contato } = await supabaseServer
    .from("myia_contacts")
    .select("id, name, number")
    .eq("id", chat.contact_id)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (!contato) return { contactId: null, nome: null, telefone: null }
  return { contactId: contato.id, nome: contato.name, telefone: contato.number }
}

/**
 * Confere que o agendamento é do paciente deste chat.
 *
 * É a fronteira de `remarcar` e `cancelar`. Sem ela, qualquer uuid que o modelo
 * produzisse — de uma alucinação a um id que o próprio paciente digitou — daria
 * acesso de escrita ao agendamento de outra pessoa da mesma clínica.
 */
async function agendamentoDoPaciente(ctx: ToolContext, appointmentId: string) {
  const dono = await donoDoChat(ctx)
  if (!dono.contactId) {
    throw new Error(
      "não consigo identificar o cadastro deste paciente para localizar a consulta",
    )
  }

  const { data, error } = await supabaseServer
    .from("myia_appointments")
    .select(
      "id, company_id, client_id, professional_id, service_id, appointment_date, start_time, end_time, status, notes",
    )
    .eq("id", appointmentId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (error) throw new Error(error.message)

  // Mesma mensagem para "não existe" e "é de outro paciente", de propósito:
  // distinguir as duas transformaria a tool num oráculo de quais ids existem
  // nesta clínica.
  if (!data || data.client_id !== dono.contactId) {
    throw new Error("não encontrei essa consulta no cadastro deste paciente")
  }

  return data
}

/**
 * O horário cabe dentro do que a clínica publicou?
 *
 * Devolve `null` quando cabe, ou a explicação de por que não. Não decide sobre
 * ocupação — quem faz isso é o gatilho de 0029, atomicamente.
 */
async function foraDaAgenda(
  ctx: ToolContext,
  professionalId: string,
  serviceId: string,
  data: string,
  inicioMin: number,
  fimMin: number,
): Promise<string | null> {
  const weekday = isoWeekday(new Date(`${data}T00:00:00Z`))

  const { data: regras, error } = await supabaseServer
    .from("myia_professional_availability")
    .select("weekday, start_time, end_time")
    .eq("professional_id", professionalId)
    .eq("service_id", serviceId)
    .eq("weekday", weekday)

  if (error) throw new Error(error.message)

  if (!regras?.length) {
    return "esse profissional não atende esse serviço nesse dia da semana"
  }

  const cabe = regras.some(
    (r) => toMinutes(String(r.start_time)) <= inicioMin && fimMin <= toMinutes(String(r.end_time)),
  )

  if (!cabe) {
    const janelas = regras
      .map((r) => `${String(r.start_time).slice(0, 5)}–${String(r.end_time).slice(0, 5)}`)
      .join(", ")
    return `esse horário fica fora do expediente do profissional nesse dia (${janelas})`
  }

  return null
}

/** Valida "HH:MM" e devolve minutos desde a meia-noite. */
function horarioEmMinutos(horario: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(horario.trim())
  if (!m) throw new Error(`horário inválido: "${horario}". Use HH:MM, por exemplo 14:30`)
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) throw new Error(`horário inválido: "${horario}"`)
  return h * 60 + min
}

/** Valida "AAAA-MM-DD" e recusa data no passado. */
function validarData(data: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.trim())) {
    throw new Error(`data inválida: "${data}". Use AAAA-MM-DD, por exemplo 2026-08-20`)
  }
  const hoje = new Date().toISOString().slice(0, 10)
  if (data < hoje) throw new Error("essa data já passou")
  return data.trim()
}

export function buildWriteTools(ctx: ToolContext) {
  const agendar_consulta = betaTool({
    name: "agendar_consulta",
    description:
      "Marca uma consulta para o paciente deste chat. Use SOMENTE um horário que consultar_disponibilidade acabou de devolver — não invente e não reaproveite horário de uma consulta antiga. Confirme com o paciente o serviço, o profissional, o dia e a hora ANTES de chamar esta ferramenta: ela marca de verdade.",
    inputSchema: {
      type: "object",
      properties: {
        service_id: { type: "string", description: "id do serviço, de buscar_servicos" },
        professional_id: {
          type: "string",
          description: "id do profissional, de consultar_disponibilidade",
        },
        data: { type: "string", description: "AAAA-MM-DD" },
        horario: { type: "string", description: "HH:MM, exatamente como veio em consultar_disponibilidade" },
        nome_do_paciente: {
          type: "string",
          description:
            "Nome do paciente, se ele informou um diferente do que já está no cadastro. Omita para usar o cadastro.",
        },
        observacao: {
          type: "string",
          description: "Recado curto para a recepção. Não escreva informação clínica aqui.",
        },
      },
      required: ["service_id", "professional_id", "data", "horario"],
      additionalProperties: false,
    },
    run: async (args) =>
      traced(ctx, "agendar_consulta", args, async () => {
        const data = validarData(args.data)
        const inicio = horarioEmMinutos(args.horario)

        const { data: servico, error: svcErr } = await supabaseServer
          .from("myia_services")
          .select("id, name, tempo_medio")
          .eq("id", args.service_id)
          .eq("company_id", ctx.companyId)
          .maybeSingle()

        if (svcErr) throw new Error(svcErr.message)
        if (!servico) throw new Error("serviço não encontrado nesta clínica")

        const { data: profissional, error: profErr } = await supabaseServer
          .from("myia_professionals_medical")
          .select("id, nome")
          .eq("id", args.professional_id)
          .eq("company_id", ctx.companyId)
          .maybeSingle()

        if (profErr) throw new Error(profErr.message)
        if (!profissional) throw new Error("profissional não encontrado nesta clínica")

        const duracao = parseDurationMinutes(servico.tempo_medio)
        const fim = inicio + duracao

        const impedimento = await foraDaAgenda(
          ctx,
          profissional.id,
          servico.id,
          data,
          inicio,
          fim,
        )
        if (impedimento) throw new Error(impedimento)

        const dono = await donoDoChat(ctx)
        const nome = args.nome_do_paciente?.trim() || dono.nome

        const { data: criado, error: insErr } = await supabaseServer
          .from("myia_appointments")
          .insert({
            company_id: ctx.companyId,
            professional_id: profissional.id,
            service_id: servico.id,
            client_id: dono.contactId,
            appointment_date: data,
            start_time: toHHMM(inicio),
            end_time: toHHMM(fim),
            status: "scheduled",
            cliente_nome: nome,
            cliente_telefone: dono.telefone,
            notes: args.observacao?.trim() || null,
          })
          .select("id")
          .single()

        if (insErr) {
          // O gatilho de 0029 pegou uma corrida: alguém marcou este horário
          // entre a consulta de disponibilidade e agora. Devolver isto como
          // resultado (não como exceção) é o que faz o modelo oferecer outro
          // horário em vez de o turno morrer.
          if (insErr.code === CAPACIDADE_ESGOTADA) {
            throw new Error(
              "esse horário acabou de ser ocupado. Consulte a disponibilidade de novo e ofereça outro.",
            )
          }
          throw new Error(insErr.message)
        }

        return {
          agendado: true,
          id: criado.id,
          servico: servico.name,
          profissional: profissional.nome,
          data,
          horario: toHHMM(inicio),
          duracao_minutos: duracao,
        }
      }),
  })

  const remarcar_consulta = betaTool({
    name: "remarcar_consulta",
    description:
      "Muda a data e a hora de uma consulta JÁ MARCADA deste paciente. Pegue o id em identificar_paciente e o novo horário em consultar_disponibilidade. Confirme com o paciente antes de chamar.",
    inputSchema: {
      type: "object",
      properties: {
        appointment_id: {
          type: "string",
          description: "id da consulta, obtido em identificar_paciente",
        },
        data: { type: "string", description: "nova data, AAAA-MM-DD" },
        horario: { type: "string", description: "novo horário, HH:MM" },
        professional_id: {
          type: "string",
          description:
            "Só quando o paciente quiser trocar de profissional. Omita para manter o mesmo.",
        },
      },
      required: ["appointment_id", "data", "horario"],
      additionalProperties: false,
    },
    run: async (args) =>
      traced(ctx, "remarcar_consulta", args, async () => {
        const atual = await agendamentoDoPaciente(ctx, args.appointment_id)

        if (atual.status === "cancelled") {
          throw new Error("essa consulta foi cancelada — marque uma nova em vez de remarcar")
        }
        if (atual.status === "completed") {
          throw new Error("essa consulta já foi realizada")
        }

        const data = validarData(args.data)
        const inicio = horarioEmMinutos(args.horario)
        const professionalId = args.professional_id ?? atual.professional_id

        if (args.professional_id) {
          const { data: prof } = await supabaseServer
            .from("myia_professionals_medical")
            .select("id")
            .eq("id", args.professional_id)
            .eq("company_id", ctx.companyId)
            .maybeSingle()
          if (!prof) throw new Error("profissional não encontrado nesta clínica")
        }

        // A duração vem do serviço, não do agendamento antigo: se a clínica
        // mudou o tempo do procedimento, o horário novo tem de valer o tempo
        // novo — senão a agenda passa a mentir a partir da primeira remarcação.
        const { data: servico } = await supabaseServer
          .from("myia_services")
          .select("id, name, tempo_medio")
          .eq("id", atual.service_id)
          .eq("company_id", ctx.companyId)
          .maybeSingle()

        const duracao = parseDurationMinutes(servico?.tempo_medio ?? null)
        const fim = inicio + duracao

        const impedimento = await foraDaAgenda(
          ctx,
          professionalId,
          atual.service_id,
          data,
          inicio,
          fim,
        )
        if (impedimento) throw new Error(impedimento)

        // Atualiza a linha no lugar, mantendo `scheduled`. O status
        // 'rescheduled' existe no schema para marcar a consulta ANTIGA quando a
        // clínica prefere guardar as duas; aqui há uma linha só, e deixá-la
        // como 'rescheduled' faria a consulta futura parecer encerrada.
        const { error: updErr } = await supabaseServer
          .from("myia_appointments")
          .update({
            professional_id: professionalId,
            appointment_date: data,
            start_time: toHHMM(inicio),
            end_time: toHHMM(fim),
            updated_at: new Date().toISOString(),
          })
          .eq("id", atual.id)
          .eq("company_id", ctx.companyId)

        if (updErr) {
          if (updErr.code === CAPACIDADE_ESGOTADA) {
            throw new Error(
              "esse horário acabou de ser ocupado. Consulte a disponibilidade de novo e ofereça outro. A consulta original continua marcada.",
            )
          }
          throw new Error(updErr.message)
        }

        return {
          remarcado: true,
          id: atual.id,
          de: { data: atual.appointment_date, horario: String(atual.start_time).slice(0, 5) },
          para: { data, horario: toHHMM(inicio) },
          servico: servico?.name ?? null,
        }
      }),
  })

  const cancelar_consulta = betaTool({
    name: "cancelar_consulta",
    description:
      "Cancela uma consulta deste paciente. Pegue o id em identificar_paciente. Confirme com o paciente qual consulta, com dia e hora, antes de chamar — cancelamento não se desfaz por aqui.",
    inputSchema: {
      type: "object",
      properties: {
        appointment_id: {
          type: "string",
          description: "id da consulta, obtido em identificar_paciente",
        },
        motivo: {
          type: "string",
          description: "Motivo, nas palavras do paciente, se ele der um. Curto.",
        },
      },
      required: ["appointment_id"],
      additionalProperties: false,
    },
    run: async (args) =>
      traced(ctx, "cancelar_consulta", args, async () => {
        const atual = await agendamentoDoPaciente(ctx, args.appointment_id)

        if (atual.status === "cancelled") {
          return { cancelado: true, ja_estava_cancelada: true, id: atual.id }
        }
        if (atual.status === "completed") {
          throw new Error("essa consulta já foi realizada e não pode ser cancelada")
        }

        const motivo = args.motivo?.trim()
        const notas = [atual.notes, motivo && `Cancelado pelo paciente: ${motivo}`]
          .filter(Boolean)
          .join("\n")

        const { error } = await supabaseServer
          .from("myia_appointments")
          .update({
            status: "cancelled",
            notes: notas || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", atual.id)
          .eq("company_id", ctx.companyId)

        if (error) throw new Error(error.message)

        return {
          cancelado: true,
          id: atual.id,
          data: atual.appointment_date,
          horario: String(atual.start_time).slice(0, 5),
        }
      }),
  })

  return [agendar_consulta, remarcar_consulta, cancelar_consulta]
}

// ---------------------------------------------------------------------------
// Escalonamento (P3.5)
// ---------------------------------------------------------------------------
/**
 * O freio de mão.
 *
 * `myia_chat.chat_pause` já era respeitado por `processAgentTurn` — a checagem
 * está lá desde o P3.3, feita a cada turno justamente porque um humano pode
 * assumir DEPOIS de o job entrar na fila. O que faltava era o agente conseguir
 * puxar esse freio sozinho.
 *
 * Sem isto, um paciente que o agente não sabe atender fica preso conversando
 * com a máquina até desistir — e desistir, numa clínica, quer dizer não ser
 * atendido. É a diferença entre um assistente e uma armadilha.
 *
 * A pausa é ligada e nunca desligada por aqui: quem retoma é a pessoa, pela
 * inbox. Um agente que pudesse se despausar transformaria a transferência numa
 * sugestão.
 */
export function buildEscalationTools(ctx: ToolContext) {
  const transferir_para_humano = betaTool({
    name: "transferir_para_humano",
    description:
      "Passa esta conversa para um atendente humano e para de responder. Use quando: o paciente pedir para falar com alguém; houver queixa, urgência ou sinal de risco à saúde; o assunto for cobrança, convênio ou reclamação que você não resolve; ou você já tiver tentado duas vezes sem entender o que ele precisa. Antes de chamar, diga ao paciente que vai chamar alguém da equipe — ele não vai receber mais nenhuma mensagem sua depois disto.",
    inputSchema: {
      type: "object",
      properties: {
        motivo: {
          type: "string",
          description:
            "Por que está transferindo, em uma frase, para a pessoa que assumir entender o contexto sem reler a conversa inteira.",
        },
        urgente: {
          type: "boolean",
          description:
            "true quando houver menção a sintoma grave, risco à vida ou emergência. A recepção prioriza.",
        },
      },
      required: ["motivo"],
      additionalProperties: false,
    },
    run: async (args) =>
      traced(ctx, "transferir_para_humano", args, async () => {
        const { data: chat, error: chatErr } = await supabaseServer
          .from("myia_chat")
          .select("id, company_id, chat_pause")
          .eq("id", ctx.chatId)
          .maybeSingle()

        if (chatErr) throw new Error(chatErr.message)
        if (!chat || chat.company_id !== ctx.companyId) {
          throw new Error("chat não pertence a esta clínica")
        }
        if (chat.chat_pause) {
          return { transferido: true, ja_estava: true }
        }

        const { error } = await supabaseServer
          .from("myia_chat")
          .update({ chat_pause: true, updated_at: new Date().toISOString() })
          .eq("id", chat.id)
          .eq("company_id", ctx.companyId)

        if (error) throw new Error(error.message)

        return {
          transferido: true,
          urgente: args.urgente === true,
          motivo: args.motivo,
          // Dito ao modelo em voz alta: a próxima mensagem dele é a última.
          aviso:
            "A conversa está agora com a equipe. Responda ao paciente uma única vez, avisando que alguém vai continuar o atendimento, e não use mais nenhuma ferramenta.",
        }
      }),
  })

  return [transferir_para_humano]
}
