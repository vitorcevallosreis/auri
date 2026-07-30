import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema"
import { supabaseServer } from "./supabase.mts"

/**
 * Superfície de tools do agente — somente LEITURA nesta fase (P3.3).
 * Escrita (agendar/remarcar/cancelar) é o P3.4.
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
    return JSON.stringify({
      erro: "não foi possível consultar agora",
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
