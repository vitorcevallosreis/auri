import Anthropic from "@anthropic-ai/sdk"
import type { TemplateField } from "@/hooks/useMedicalRecords"

/**
 * Redação do rascunho clínico a partir da transcrição.
 *
 * SERVER-ONLY, pela mesma razão e com a mesma ressalva de
 * `transcricao.ts`: importar daqui de um componente quebra em runtime.
 *
 * O modelo de prontuário escolhido pelo médico vira o ESQUEMA DE SAÍDA: as
 * chaves que o Claude pode devolver são exatamente as do template, garantidas
 * por structured outputs. Não é preferência de estilo — é o que impede o
 * rascunho de chegar com campos que a tela não sabe renderizar, ou de faltar
 * campo que o modelo define.
 */

const MODELO = process.env.ESCUTA_MODEL ?? "claude-opus-5"
const MAX_TOKENS = Number(process.env.ESCUTA_MAX_TOKENS ?? 8000)

let cliente: Anthropic | null = null
function getCliente(): Anthropic {
  if (!cliente) cliente = new Anthropic()
  return cliente
}

export class RedacaoIndisponivel extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = "RedacaoIndisponivel"
  }
}

/** Esquema JSON derivado dos campos do modelo. */
function esquemaDoTemplate(campos: TemplateField[]) {
  const properties: Record<string, any> = {}
  for (const c of campos) {
    const descricao = [c.label, c.hint].filter(Boolean).join(" — ")
    properties[c.key] =
      c.type === "select" && c.options?.length
        ? { type: "string", enum: c.options, description: descricao }
        : { type: "string", description: descricao }
  }
  return {
    type: "object" as const,
    properties,
    // Todos obrigatórios: o modelo devolve string vazia para o que a consulta
    // não cobriu, em vez de omitir a chave. É a diferença entre a tela dizer
    // "Não registrado neste atendimento" e o campo sumir sem explicação.
    required: campos.map((c) => c.key),
    additionalProperties: false,
  }
}

const SISTEMA = `Você redige rascunhos de prontuário a partir da transcrição de uma consulta médica, em português do Brasil.

Regras que não se negociam:
- Registre APENAS o que foi dito na consulta. Nunca infira diagnóstico, dose, exame ou conduta que não apareça na transcrição.
- Campo sem informação na consulta recebe string vazia. Não preencha com "não informado", "sem alterações" nem com o que costuma ser verdade — um campo vazio é honesto, um campo inventado vira registro clínico falso.
- Não converta suposição em afirmação. Se o paciente disse "acho que tive febre", escreva que ele relata suspeita de febre; não registre febre.
- Use a terminologia médica que o profissional usou, não a do paciente, exceto na queixa — a queixa é a voz do paciente.
- Escreva em terceira pessoa, no registro impessoal do prontuário. Sem saudação, sem meta-comentário sobre a transcrição, sem observações sobre a qualidade do áudio.
- Se a transcrição estiver truncada ou incompreensível num trecho, deixe vazio o campo correspondente em vez de adivinhar.

O texto é um RASCUNHO: o médico vai revisar e assinar. Um campo em branco ele completa em segundos; uma invenção ele pode não pegar.`

export interface RascunhoGerado {
  content: Record<string, string>
  modelo: string
}

export async function redigirRascunho(
  transcricao: string,
  campos: TemplateField[],
  contexto: { paciente?: string | null; servico?: string | null }
): Promise<RascunhoGerado> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new RedacaoIndisponivel(
      "A redação por IA não está configurada nesta instalação (falta ANTHROPIC_API_KEY)."
    )
  }
  if (!campos.length) {
    throw new RedacaoIndisponivel("O modelo de prontuário não tem campos.")
  }

  const cabecalho = [
    contexto.paciente && `Paciente: ${contexto.paciente}`,
    contexto.servico && `Atendimento: ${contexto.servico}`,
  ]
    .filter(Boolean)
    .join("\n")

  try {
    const resposta = await getCliente().messages.create({
      model: MODELO,
      max_tokens: MAX_TOKENS,
      system: SISTEMA,
      output_config: {
        effort: "high",
        format: {
          type: "json_schema",
          schema: esquemaDoTemplate(campos),
        },
      },
      messages: [
        {
          role: "user",
          content: `${cabecalho}\n\nTranscrição da consulta:\n\n${transcricao}`,
        },
      ],
    })

    // `stop_reason` antes de ler o conteúdo: numa recusa o array vem vazio e
    // indexar content[0] estoura. Numa consulta sobre tema sensível isso é
    // plausível o bastante para tratar.
    if (resposta.stop_reason === "refusal") {
      throw new RedacaoIndisponivel(
        "O modelo recusou redigir a partir desta transcrição. Escreva o prontuário manualmente."
      )
    }
    if (resposta.stop_reason === "max_tokens") {
      throw new RedacaoIndisponivel(
        "A consulta foi longa demais para um rascunho só. Escreva o prontuário manualmente."
      )
    }

    const bloco = resposta.content.find((b) => b.type === "text")
    if (!bloco || bloco.type !== "text") {
      throw new RedacaoIndisponivel("O modelo não devolveu texto.")
    }

    const bruto = JSON.parse(bloco.text) as Record<string, unknown>

    // Filtra pelas chaves do modelo mesmo com structured outputs garantindo a
    // forma: o que chega aqui vai direto para `content` do prontuário, e essa
    // é a última fronteira antes do banco.
    const content: Record<string, string> = {}
    for (const c of campos) {
      const v = bruto[c.key]
      content[c.key] = typeof v === "string" ? v.trim() : ""
    }

    return { content, modelo: resposta.model }
  } catch (err: any) {
    if (err instanceof RedacaoIndisponivel) throw err
    if (err instanceof Anthropic.RateLimitError) {
      throw new RedacaoIndisponivel("A IA está sobrecarregada. Tente de novo em instantes.")
    }
    if (err instanceof Anthropic.APIError) {
      throw new RedacaoIndisponivel(`A redação falhou (${err.status}).`)
    }
    if (err instanceof SyntaxError) {
      throw new RedacaoIndisponivel("A resposta da IA veio malformada.")
    }
    throw new RedacaoIndisponivel("A redação falhou por um erro inesperado.")
  }
}
