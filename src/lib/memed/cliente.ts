/**
 * Cliente da API da Memed (Sinapse Prescrição).
 *
 * SERVER-ONLY — lê `MEMED_SECRET_KEY`. A documentação da Memed é explícita:
 * a secret key nunca pode aparecer no front-end. O único valor que sai daqui
 * para o navegador é o TOKEN DO PRESCRITOR, que é justamente o que o módulo
 * deles espera em `data-token`.
 *
 * Endpoints conforme doc.memed.com.br/docs/backend/usuario-prescritor:
 *   GET  {API}/sinapse-prescricao/usuarios/{id}?api-key=&secret-key=
 *   POST {API}/sinapse-prescricao/usuarios?api-key=&secret-key=
 * O identificador do GET aceita CPF (11 dígitos), external_id ou registro+UF
 * ("118432SP") — é essa última forma que nos permite achar um prescritor que
 * já existe lá antes de tentar criar.
 */

export interface MemedConfig {
  apiUrl: string
  scriptUrl: string
  apiKey: string
  secretKey: string
}

export class MemedIndisponivel extends Error {
  /** `dadosFaltando` distingue "a integração não está ligada" de "falta
   *  preencher o cadastro deste médico" — a tela trata os dois de formas
   *  diferentes, e confundir os dois manda o médico falar com o suporte
   *  errado. */
  constructor(mensagem: string, public readonly dadosFaltando: string[] = []) {
    super(mensagem)
    this.name = "MemedIndisponivel"
  }
}

export function memedConfig(): MemedConfig | null {
  const apiKey = process.env.MEMED_API_KEY
  const secretKey = process.env.MEMED_SECRET_KEY
  if (!apiKey || !secretKey) return null
  return {
    apiKey,
    secretKey,
    apiUrl: process.env.MEMED_API_URL ?? "https://integrations.api.memed.com.br/v1",
    scriptUrl:
      process.env.MEMED_SCRIPT_URL ??
      "https://integrations.memed.com.br/modulos/plataforma.sinapse-prescricao/build/sinapse-prescricao.min.js",
  }
}

export interface Prescritor {
  id: string
  nome: string
  cpf: string | null
  dataNascimento: string | null
  conselhoSigla: string | null
  conselhoNumero: string | null
  conselhoUf: string | null
  email: string | null
  telefone: string | null
}

function url(cfg: MemedConfig, caminho: string) {
  const u = new URL(`${cfg.apiUrl}/sinapse-prescricao/usuarios${caminho}`)
  u.searchParams.set("api-key", cfg.apiKey)
  u.searchParams.set("secret-key", cfg.secretKey)
  return u
}

/** Divide "Dra. Helena Marques" em nome e sobrenome — a Memed exige os dois
 *  separados e nós guardamos um campo só. Título é descartado. */
function partirNome(completo: string): { nome: string; sobrenome: string } {
  const partes = completo
    .replace(/^(dr|dra|dr\.|dra\.)\s+/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (partes.length === 0) return { nome: "Profissional", sobrenome: "-" }
  if (partes.length === 1) return { nome: partes[0], sobrenome: "-" }
  return { nome: partes[0], sobrenome: partes.slice(1).join(" ") }
}

/** O que a Memed exige para CRIAR um prescritor. */
export function camposFaltando(p: Prescritor): string[] {
  const falta: string[] = []
  if (!p.cpf) falta.push("CPF")
  if (!p.dataNascimento) falta.push("data de nascimento")
  if (!p.conselhoSigla) falta.push("conselho (CRM, CRO…)")
  if (!p.conselhoNumero) falta.push("número do conselho")
  if (!p.conselhoUf) falta.push("UF do conselho")
  return falta
}

async function buscar(cfg: MemedConfig, identificador: string): Promise<string | null> {
  const resp = await fetch(url(cfg, `/${encodeURIComponent(identificador)}`), {
    // Cabeçalhos conforme o exemplo cURL da doc: o `Accept` é vnd.api+json
    // (JSON:API), mas o `Content-Type` deles é `application/json` — mandar
    // vnd.api+json aqui é o tipo de divergência que vira 415 sem explicação.
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
    cache: "no-store",
  })
  // 404 é resposta esperada — significa "ainda não cadastrado lá", que é o
  // caminho normal na primeira prescrição de cada médico.
  if (resp.status === 404) return null
  if (!resp.ok) {
    throw new MemedIndisponivel(`A Memed respondeu ${resp.status} ao buscar o prescritor.`)
  }
  const json: any = await resp.json()
  return json?.data?.attributes?.token ?? null
}

async function criar(cfg: MemedConfig, p: Prescritor): Promise<string> {
  const { nome, sobrenome } = partirNome(p.nome)
  const [ano, mes, dia] = (p.dataNascimento ?? "").split("-")

  const resp = await fetch(url(cfg, ""), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/vnd.api+json",
    },
    body: JSON.stringify({
      data: {
        type: "usuarios",
        attributes: {
          // `external_id` é o nosso id do profissional: é o que amarra os dois
          // cadastros e o que permite reencontrar o prescritor depois sem
          // depender do CPF.
          external_id: p.id,
          nome,
          sobrenome,
          cpf: p.cpf,
          data_nascimento: `${dia}/${mes}/${ano}`,
          board: {
            board_code: p.conselhoSigla,
            board_number: p.conselhoNumero,
            board_state: p.conselhoUf,
          },
          ...(p.email ? { email: p.email } : {}),
          ...(p.telefone ? { telefone: p.telefone.replace(/\D/g, "") } : {}),
        },
      },
    }),
    cache: "no-store",
  })

  if (!resp.ok) {
    const detalhe = await resp.text().catch(() => "")
    throw new MemedIndisponivel(
      `A Memed recusou o cadastro do prescritor (${resp.status}). ${detalhe.slice(0, 300)}`
    )
  }

  const json: any = await resp.json()
  const token = json?.data?.attributes?.token
  if (!token) {
    throw new MemedIndisponivel("A Memed cadastrou o prescritor mas não devolveu token.")
  }
  return token
}

/**
 * Token do prescritor: acha o que já existe ou cadastra.
 *
 * A busca vem primeiro e tenta três identificadores porque o prescritor pode
 * já existir na Memed por outro caminho — a clínica usava a Memed antes, ou o
 * médico atende em mais de um lugar. Cadastrar por cima devolveria erro de
 * duplicidade num fluxo em que o médico só quer prescrever.
 *
 * A doc da Memed é explícita: o token NÃO é estático e deve ser buscado a cada
 * uso. Por isso nada aqui é guardado em cache nem gravado no nosso banco.
 */
export async function tokenDoPrescritor(p: Prescritor): Promise<string> {
  const cfg = memedConfig()
  if (!cfg) {
    throw new MemedIndisponivel(
      "A prescrição digital não está configurada nesta instalação (faltam MEMED_API_KEY e MEMED_SECRET_KEY)."
    )
  }

  const identificadores = [
    p.id,
    p.cpf ?? null,
    p.conselhoNumero && p.conselhoUf ? `${p.conselhoNumero}${p.conselhoUf}` : null,
  ].filter(Boolean) as string[]

  for (const ident of identificadores) {
    const token = await buscar(cfg, ident)
    if (token) return token
  }

  const falta = camposFaltando(p)
  if (falta.length) {
    throw new MemedIndisponivel(
      `Faltam dados no seu cadastro para a Memed: ${falta.join(", ")}.`,
      falta
    )
  }

  return criar(cfg, p)
}
