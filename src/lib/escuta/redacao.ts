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

const MAX_TOKENS = Number(process.env.ESCUTA_MAX_TOKENS ?? 8000)

/**
 * QUEM REDIGE é configurável; O QUE SE PEDE, não.
 *
 * O esquema derivado do template, o prompt clínico e a filtragem final são
 * compartilhados por todos os provedores — são eles que definem o que conta
 * como um rascunho aceitável, e não podem variar com a conta que a clínica
 * conseguiu abrir. O que muda abaixo é só a chamada.
 *
 * `anthropic` continua o alvo para escala. `openai-compat` existe para validar
 * sem custo (Groq) e serve qualquer servidor que fale o mesmo protocolo.
 */
// Lido a cada chamada, não no carregamento do módulo: um `const` no topo
// congela o valor no primeiro import, o que torna o comportamento dependente
// da ordem de importação e o portão impossível de testar sem subir um
// processo por configuração.
function provedor(): string {
  return process.env.ESCUTA_PROVIDER ?? "anthropic"
}

function modeloPadrao(): string {
  if (process.env.ESCUTA_MODEL) return process.env.ESCUTA_MODEL
  return provedor() === "anthropic" ? "claude-opus-5" : "openai/gpt-oss-120b"
}

let cliente: Anthropic | null = null
function getCliente(): Anthropic {
  if (!cliente) cliente = new Anthropic()
  return cliente
}

/** O que falta para a redação funcionar; `null` quando está pronta. */
export function redacaoPendencia(): string | null {
  if (provedor() === "anthropic") {
    return process.env.ANTHROPIC_API_KEY
      ? null
      : "A redação por IA não está configurada nesta instalação (falta ANTHROPIC_API_KEY)."
  }
  if (provedor() === "openai-compat") {
    if (!process.env.ESCUTA_BASE_URL) {
      return "A redação por IA não está configurada nesta instalação (falta ESCUTA_BASE_URL)."
    }
    return null
  }
  return `Provedor de redação desconhecido: "${provedor()}". Disponíveis: anthropic, openai-compat.`
}

export class RedacaoIndisponivel extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = "RedacaoIndisponivel"
  }
}

/**
 * Esquema JSON derivado dos campos do modelo.
 *
 * Exportado só para teste: é a peça que decide se uma consulta vira rascunho
 * ou vira erro 400, e ela não é observável de fora sem uma chamada real ao
 * provedor. Ninguém fora deste módulo deve chamá-la.
 */
export function esquemaDoTemplate(campos: TemplateField[]) {
  const properties: Record<string, any> = {}
  for (const c of campos) {
    const descricao = [c.label, c.hint].filter(Boolean).join(" — ")
    properties[c.key] =
      c.type === "select" && c.options?.length
        ? {
            type: "string",
            // O "" ENTRA NO ENUM, e isto não é frouxidão de esquema.
            //
            // O prompt manda deixar vazio o campo que a consulta não cobriu, e
            // todo campo é `required` logo abaixo. Num modelo com campo de
            // escolha — "Fototipo (Fitzpatrick)", opções I..VI — uma consulta
            // que não falou de fototipo obriga o modelo a devolver "", que não
            // estava entre as opções. Com decodificação restrita isso não é um
            // campo torto: é a REDAÇÃO INTEIRA recusada com 400, e a consulta
            // se perde. Aconteceu em produção (sessão 7adc72ae, 14/08).
            //
            // São 6 campos `select` no catálogo de modelos do sistema; sem o ""
            // cada um deles é uma consulta perdida esperando acontecer.
            //
            // Só o esquema do redator ganha a opção vazia. O `<select>` da tela
            // continua com as opções clínicas e nada mais — lá o médico está
            // escolhendo, não relatando ausência.
            enum: [...c.options, ""],
            description: descricao,
          }
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

/**
 * Redator via protocolo da OpenAI (Groq e afins).
 *
 * `strict: true` liga decodificação restrita: o modelo NÃO CONSEGUE devolver
 * fora do esquema. Sem isso o `json_schema` é só uma sugestão forte, e o que
 * sai daqui vai direto para `content` do prontuário. No Groq, `strict` só
 * existe em `openai/gpt-oss-20b` e `openai/gpt-oss-120b` — é por isso que o
 * padrão é o 120b, e não um modelo maior que não garante a forma.
 */
async function redigirOpenAICompat(
  esquema: object,
  cabecalho: string,
  transcricao: string
): Promise<{ texto: string; modelo: string }> {
  const base = (process.env.ESCUTA_BASE_URL ?? "").replace(/\/+$/, "")
  const modelo = modeloPadrao()
  const chave = process.env.ESCUTA_API_KEY

  const resp = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(chave ? { Authorization: `Bearer ${chave}` } : {}),
    },
    body: JSON.stringify({
      model: modelo,
      max_completion_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: SISTEMA },
        { role: "user", content: `${cabecalho}\n\nTranscrição da consulta:\n\n${transcricao}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "prontuario", schema: esquema, strict: true },
      },
    }),
  })

  if (!resp.ok) {
    const detalhe = await resp.text().catch(() => "")
    throw new RedacaoIndisponivel(`A redação falhou (${resp.status}). ${detalhe.slice(0, 200)}`)
  }

  const json: any = await resp.json()
  const escolha = json?.choices?.[0]

  // Mesma checagem que existe no caminho da Anthropic, pelo mesmo motivo: ler
  // o conteúdo antes de saber por que a geração parou esconde a causa.
  if (escolha?.finish_reason === "length") {
    throw new RedacaoIndisponivel(
      "A consulta foi longa demais para um rascunho só. Escreva o prontuário manualmente."
    )
  }
  if (escolha?.message?.refusal) {
    throw new RedacaoIndisponivel(
      "O modelo recusou redigir a partir desta transcrição. Escreva o prontuário manualmente."
    )
  }

  const texto = escolha?.message?.content
  if (!texto) throw new RedacaoIndisponivel("O modelo não devolveu texto.")

  return { texto, modelo: json?.model ?? modelo }
}

export async function redigirRascunho(
  transcricao: string,
  campos: TemplateField[],
  contexto: { paciente?: string | null; servico?: string | null }
): Promise<RascunhoGerado> {
  const pendente = redacaoPendencia()
  if (pendente) throw new RedacaoIndisponivel(pendente)
  if (!campos.length) {
    throw new RedacaoIndisponivel("O modelo de prontuário não tem campos.")
  }

  const cabecalho = [
    contexto.paciente && `Paciente: ${contexto.paciente}`,
    contexto.servico && `Atendimento: ${contexto.servico}`,
  ]
    .filter(Boolean)
    .join("\n")

  const esquema = esquemaDoTemplate(campos)

  try {
    let texto: string
    let modeloUsado: string

    if (provedor() === "openai-compat") {
      const r = await redigirOpenAICompat(esquema, cabecalho, transcricao)
      texto = r.texto
      modeloUsado = r.modelo
    } else {
      const resposta = await getCliente().messages.create({
        model: modeloPadrao(),
        max_tokens: MAX_TOKENS,
        system: SISTEMA,
        output_config: {
          effort: "high",
          format: { type: "json_schema", schema: esquema },
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
      texto = bloco.text
      modeloUsado = resposta.model
    }

    const bruto = JSON.parse(texto) as Record<string, unknown>

    // Filtra pelas chaves do modelo mesmo com structured outputs garantindo a
    // forma: o que chega aqui vai direto para `content` do prontuário, e essa
    // é a última fronteira antes do banco.
    const content: Record<string, string> = {}
    for (const c of campos) {
      const v = bruto[c.key]
      content[c.key] = typeof v === "string" ? v.trim() : ""
    }

    return { content, modelo: modeloUsado }
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
