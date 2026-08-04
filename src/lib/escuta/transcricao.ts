/**
 * Transcrição do áudio da consulta.
 *
 * SERVER-ONLY. Este módulo lê `TRANSCRICAO_API_KEY` e só pode ser importado de
 * route handlers. Não há `import "server-only"` porque o pacote não está nas
 * dependências do projeto — a garantia aqui é convenção, não compilador.
 * (Vazar a chave para o bundle não é o risco: variáveis sem `NEXT_PUBLIC_` já
 * chegam `undefined` no cliente. O risco é um componente importar isto e
 * quebrar em runtime com uma mensagem que não explica nada.)
 *
 * POR QUE UM ADAPTADOR, E NÃO UMA CHAMADA DIRETA.
 *
 * A Claude API não aceita áudio — Claude não transcreve. A transcrição é
 * sempre de terceiro, e a escolha do terceiro é uma decisão de negócio em
 * aberto: muda preço, qualidade em português, se separa as vozes de médico e
 * paciente, e — o que mais pesa aqui — em que país o áudio de um paciente
 * brasileiro é processado.
 *
 * Este arquivo é a fronteira. Trocar de fornecedor é escrever mais uma função
 * abaixo e mudar uma variável de ambiente; nada acima desta camada sabe qual
 * serviço está do outro lado.
 *
 * O ÁUDIO NÃO É PERSISTIDO em lugar nenhum: chega como buffer, vai ao
 * provedor, sai da memória. É a mesma decisão que a migration 0025 registra
 * com a ausência de uma coluna de áudio.
 */

export interface TranscricaoResultado {
  texto: string
  /** Segundos de áudio, quando o provedor informa. Só para telemetria. */
  duracao?: number
  /** Identificador do modelo usado, para o registro de procedência. */
  modelo: string
}

export interface Transcritor {
  nome: string
  transcrever(audio: Blob, opcoes: { idioma: string }): Promise<TranscricaoResultado>
}

/**
 * Cada fornecedor declara o que precisa para funcionar.
 *
 * Existe porque os requisitos divergem de verdade: um serviço na nuvem exige
 * chave; um servidor nosso na rede interna exige endereço e chave nenhuma.
 * Enquanto essa checagem morou fora daqui — numa conjunção fixa de duas
 * variáveis de ambiente dentro de `escutaDisponivel()` —, ela dizia
 * "indisponível" para qualquer arranjo que não fosse o original.
 */
interface Fabrica {
  criar(): Transcritor
  /** `null` quando está pronto; a mensagem para o operador quando não está. */
  pendencia(): string | null
}

export class TranscricaoIndisponivel extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = "TranscricaoIndisponivel"
  }
}

/**
 * Implementação de referência: Deepgram.
 *
 * Escolhida como a primeira por ser a que atende os três requisitos clínicos
 * de uma vez — português do Brasil, diarização (separar quem falou o quê numa
 * consulta é o que evita a IA atribuir ao médico o que o paciente disse) e
 * pontuação automática, que é o que torna a transcrição legível como fonte de
 * auditoria.
 *
 * NÃO é uma escolha fechada. Ver `transcritores` abaixo.
 */
function deepgram(apiKey: string): Transcritor {
  return {
    nome: "deepgram",
    async transcrever(audio, { idioma }) {
      const modelo = process.env.TRANSCRICAO_MODELO ?? "nova-3-medical"
      const url = new URL("https://api.deepgram.com/v1/listen")
      url.searchParams.set("model", modelo)
      url.searchParams.set("language", idioma)
      url.searchParams.set("punctuate", "true")
      url.searchParams.set("diarize", "true")
      url.searchParams.set("smart_format", "true")

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": audio.type || "audio/webm",
        },
        body: audio,
      })

      if (!resp.ok) {
        const detalhe = await resp.text().catch(() => "")
        throw new TranscricaoIndisponivel(
          `Transcrição falhou (${resp.status}). ${detalhe.slice(0, 200)}`
        )
      }

      const json: any = await resp.json()
      const alt = json?.results?.channels?.[0]?.alternatives?.[0]

      // Com diarização, `paragraphs` traz a fala já atribuída a um falante — é
      // o formato que interessa ao modelo depois. Sem ela, cai no transcript
      // corrido, que ainda serve.
      const comFalantes = alt?.paragraphs?.transcript as string | undefined
      const texto = (comFalantes || alt?.transcript || "").trim()

      if (!texto) {
        throw new TranscricaoIndisponivel(
          "A transcrição voltou vazia. O microfone pode não ter captado áudio."
        )
      }

      return { texto, duracao: json?.metadata?.duration, modelo: `deepgram/${modelo}` }
    },
  }
}

/**
 * Qualquer servidor que fale o protocolo de transcrição da OpenAI.
 *
 * É UM provedor, não três, de propósito: o mesmo código atende o Whisper que
 * roda no nosso VPS, o Groq e a própria OpenAI — muda `TRANSCRICAO_BASE_URL`.
 * Foi o que permitiu tirar o áudio de consulta de um serviço externo sem
 * escrever integração nova.
 *
 * A chave é OPCIONAL. O servidor na nossa rede interna não pede autenticação,
 * e mandar `Authorization: Bearer undefined` faz alguns rejeitarem a
 * requisição — por isso o header só aparece quando há chave de verdade.
 */
function openaiCompat(apiKey: string | undefined): Transcritor {
  return {
    nome: "openai-compat",
    async transcrever(audio, { idioma }) {
      const base = (process.env.TRANSCRICAO_BASE_URL ?? "").replace(/\/+$/, "")
      const modelo = process.env.TRANSCRICAO_MODELO ?? "Systran/faster-whisper-small"

      const form = new FormData()
      form.append("file", audio, "consulta.webm")
      form.append("model", modelo)
      form.append("language", idioma)
      // `verbose_json` é o que traz `duration`; o `json` simples só traz texto.
      form.append("response_format", "verbose_json")

      const resp = await fetch(`${base}/audio/transcriptions`, {
        method: "POST",
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
        body: form,
      })

      if (!resp.ok) {
        const detalhe = await resp.text().catch(() => "")
        throw new TranscricaoIndisponivel(
          `Transcrição falhou (${resp.status}). ${detalhe.slice(0, 200)}`
        )
      }

      const json: any = await resp.json()
      const texto = String(json?.text ?? "").trim()

      if (!texto) {
        throw new TranscricaoIndisponivel(
          "A transcrição voltou vazia. O microfone pode não ter captado áudio."
        )
      }

      return { texto, duracao: json?.duration, modelo: `${base}/${modelo}` }
    },
  }
}

/**
 * Registro de fornecedores.
 *
 * Para acrescentar um: escreva a função no formato acima e ponha aqui, junto
 * com o que ele exige para funcionar. O resto do sistema não muda.
 */
const transcritores: Record<string, Fabrica> = {
  deepgram: {
    criar: () => deepgram(process.env.TRANSCRICAO_API_KEY!),
    pendencia: () =>
      process.env.TRANSCRICAO_API_KEY ? null : "falta TRANSCRICAO_API_KEY",
  },
  "openai-compat": {
    criar: () => openaiCompat(process.env.TRANSCRICAO_API_KEY),
    pendencia: () =>
      process.env.TRANSCRICAO_BASE_URL ? null : "falta TRANSCRICAO_BASE_URL",
  },
}

/**
 * Resolve o transcritor configurado.
 *
 * Lança — em vez de devolver `null` — porque um caminho silencioso aqui
 * significaria consulta gravada e jogada fora sem prontuário. A falha precisa
 * chegar à tela do médico ANTES de ele conduzir o atendimento inteiro
 * confiando na escuta, e é por isso que a tela chama `escutaDisponivel()`
 * antes de ligar o microfone.
 */
export function getTranscritor(): Transcritor {
  const pendente = transcricaoPendencia()
  if (pendente) throw new TranscricaoIndisponivel(pendente)
  return transcritores[process.env.TRANSCRICAO_PROVIDER ?? "deepgram"].criar()
}

/** O que falta para a transcrição funcionar; `null` quando está pronta. */
export function transcricaoPendencia(): string | null {
  const provedor = process.env.TRANSCRICAO_PROVIDER ?? "deepgram"
  const fabrica = transcritores[provedor]
  if (!fabrica) {
    return `Provedor de transcrição desconhecido: "${provedor}". Disponíveis: ${Object.keys(transcritores).join(", ")}.`
  }
  const p = fabrica.pendencia()
  return p ? `A transcrição não está configurada nesta instalação (${p}).` : null
}

// `escutaDisponivel()` mudou para ./disponibilidade.ts: ela depende das DUAS
// pontas, e mantê-la aqui obrigava este módulo a importar o de redação — o que
// acopla transcrição a redação sem necessidade e impede que cada um seja
// carregado sozinho num teste.
