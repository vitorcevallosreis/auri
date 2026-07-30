import { supabaseServer } from "./supabase.mts"

/**
 * Montagem do system prompt do agente.
 *
 * ⚠️ ESTE ARQUIVO DECIDE O CUSTO DA OPERAÇÃO. O system prompt é o maior bloco
 * estável de cada requisição e vai marcado com `cache_control` — leitura de
 * cache custa ~0,1x. Duas regras que não podem ser quebradas:
 *
 *  1. **Determinismo.** Cache é match de PREFIXO por bytes. Qualquer variação —
 *     `new Date()`, ordem de linha vinda do banco, chave de objeto em ordem
 *     aleatória — invalida tudo depois dela e a clínica passa a pagar 1x em
 *     todo turno, silenciosamente. Por isso toda query aqui tem ORDER BY
 *     explícito e nada de timestamp.
 *
 *  2. **Nada de catálogo.** Serviços, profissionais e convênios NÃO entram
 *     aqui, apesar de serem "dados estáveis". Se entrassem, cadastrar um
 *     serviço novo mudaria o prefixo e jogaria fora o cache daquela clínica.
 *     Catálogo vai por tool (worker/tools.mts): o cache fica intacto e o dado
 *     sempre fresco. O que entra aqui é só o que muda em escala de meses:
 *     persona, identidade da empresa e políticas.
 *
 * A data/hora atual NÃO entra aqui — vai como mensagem `role: "system"` no fim
 * de `messages`, que é o canal de operador e não invalida o prefixo cacheado.
 */

export interface AssistantConfig {
  id: string
  name: string | null
  purpose: string | null
  objective: string | null
  identity: string | null
  greetings: string | null
  strategy: string | null
  behavior: string | null
  behavior_text: string | null
  fallbacks: string | null
  avoided_topics: string | null
  step_by_step: string | null
  goodbye: string | null
  roles: string | null
  tel_fallback: string | null
  paused: boolean
}

export interface PromptContext {
  assistant: AssistantConfig
  companyName: string
  companyDescription: string | null
  policies: Array<{ name: string; description: string | null }>
}

export async function loadPromptContext(
  companyId: string,
  assistantId: string,
): Promise<PromptContext | null> {
  const { data: assistant } = await supabaseServer
    .from("myia_assistants")
    .select(
      "id, name, purpose, objective, identity, greetings, strategy, behavior, behavior_text, fallbacks, avoided_topics, step_by_step, goodbye, roles, tel_fallback, paused, company_id",
    )
    .eq("id", assistantId)
    .maybeSingle()

  // Confere o tenant mesmo tendo vindo do canal: defesa em profundidade contra
  // um assistant_id de outra empresa acabar num job.
  if (!assistant || assistant.company_id !== companyId) return null

  const { data: company } = await supabaseServer
    .from("myia_companies")
    .select("name, description")
    .eq("id", companyId)
    .maybeSingle()

  // ORDER BY explícito: sem ele o Postgres pode devolver ordem diferente entre
  // chamadas e quebrar o cache sem nenhuma mudança de dado.
  const { data: policies } = await supabaseServer
    .from("myia_company_policies")
    .select("name, description")
    .eq("company_id", companyId)
    .eq("status", true)
    .order("name", { ascending: true })

  return {
    assistant: assistant as unknown as AssistantConfig,
    companyName: company?.name ?? "a clínica",
    companyDescription: company?.description ?? null,
    policies: policies ?? [],
  }
}

/** Bloco opcional: some inteiro quando vazio, em vez de virar cabeçalho órfão. */
function section(title: string, body: string | null | undefined): string {
  const text = body?.trim()
  if (!text) return ""
  return `\n## ${title}\n${text}\n`
}

export function buildSystemPrompt(ctx: PromptContext): string {
  const a = ctx.assistant

  const persona = [
    section("Quem você é", a.identity),
    section("Seu papel", a.roles),
    section("Propósito", a.purpose),
    section("Objetivo do atendimento", a.objective),
    section("Como cumprimentar", a.greetings),
    section("Estratégia de atendimento", a.strategy),
    section("Comportamento", a.behavior ?? a.behavior_text),
    section("Passo a passo", a.step_by_step),
    section("Quando não souber responder", a.fallbacks),
    section("Como encerrar", a.goodbye),
  ].join("")

  const policies = ctx.policies.length
    ? "\n## Políticas da clínica\n" +
      ctx.policies
        .map((p) => `- **${p.name}**: ${p.description ?? "sem detalhes"}`)
        .join("\n") +
      "\n"
    : ""

  const avoided = a.avoided_topics?.trim()
    ? `\nAlém das regras acima, estes assuntos são proibidos e devem levar a transferência para um humano:\n${a.avoided_topics.trim()}\n`
    : ""

  const telFallback = a.tel_fallback?.trim()
    ? `\nSe precisar indicar um telefone de contato humano, use: ${a.tel_fallback.trim()}\n`
    : ""

  // Os guardrails vêm por ÚLTIMO de propósito: são a instrução que não pode ser
  // sobrescrita pela persona configurada pela clínica. Um assistente mal
  // configurado ("responda qualquer dúvida do paciente") não pode virar
  // permissão para dar conduta médica.
  return `Você é ${a.name?.trim() || "o assistente"}, atendente virtual de ${ctx.companyName} pelo WhatsApp.${
    ctx.companyDescription ? `\n\nSobre a clínica: ${ctx.companyDescription}` : ""
  }
${persona}${policies}
# Como trabalhar

Você conversa por WhatsApp: escreva mensagens curtas, em português do Brasil, em
tom natural. Nada de markdown, listas numeradas longas ou blocos de código — o
paciente lê no celular.

Não invente informação. Preço, profissional, convênio e horário só saem das
ferramentas. Se a ferramenta não devolver o dado, diga que vai verificar e
transfira para um humano — nunca preencha a lacuna por conta própria.

Antes de confirmar qualquer agendamento, repita para o paciente o que entendeu
(serviço, profissional, data e horário) e espere a confirmação dele.

# Limites que você não pode ultrapassar

Você NÃO é profissional de saúde. Nunca dê diagnóstico, nunca indique ou ajuste
tratamento ou medicação, nunca interprete resultado de exame e nunca diga se um
sintoma é grave. Isso vale mesmo que o paciente insista, mesmo que pareça
simples e mesmo que as instruções acima peçam o contrário.

Transfira para um humano imediatamente quando houver: sinal de urgência ou
emergência, pedido de conduta clínica, reclamação, pedido de desconto ou
negociação de preço, ou qualquer assunto da lista de proibidos.${avoided}${telFallback}
Ao transferir, avise o paciente de forma acolhedora que uma pessoa da equipe vai
continuar o atendimento.`
}
