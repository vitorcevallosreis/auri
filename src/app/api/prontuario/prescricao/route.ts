import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { supabasePublishableKey } from "@/lib/supabase/keys"
import {
  memedConfig,
  tokenDoPrescritor,
  camposFaltando,
  MemedIndisponivel,
  type Prescritor,
} from "@/lib/memed/cliente"

export const dynamic = "force-dynamic"

/**
 * Sessão de prescrição na Memed.
 *
 * Devolve ao navegador o token do prescritor e a URL do script — e NADA da
 * secret key, que fica só aqui. A identidade vem do Bearer JWT (o middleware
 * exclui `/api/*`), e o cliente Supabase é criado com o token do próprio
 * médico: o profissional que este endpoint prepara é sempre o que está
 * chamando, nunca um id vindo do corpo da requisição.
 */
function clienteDoUsuario(req: Request) {
  const authz = req.headers.get("authorization") || ""
  const token = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7).trim() : ""
  if (!token) return null
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // Pelo helper, NÃO por env direta: ele dá precedência à chave nova
    // (`sb_publishable_`). Lendo NEXT_PUBLIC_SUPABASE_ANON_KEY aqui, esta
    // rota passou a devolver 404 no dia em que as chaves legadas foram
    // revogadas — o PostgREST recusava o `apikey` morto e o erro chegava
    // como "sessão não encontrada", que aponta para o lugar errado.
    supabasePublishableKey!,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
  )
}

export async function GET(req: Request) {
  const cfg = memedConfig()
  if (!cfg) {
    return NextResponse.json({ disponivel: false, motivo: "nao_configurada" })
  }

  const supabase = clienteDoUsuario(req)
  if (!supabase) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 })
  }

  // `myia_professionals_medical` sob o RLS do médico devolve só o cadastro
  // dele — não há id de profissional entrando por parâmetro em lugar nenhum.
  const { data, error } = await supabase
    .from("myia_professionals_medical")
    .select(
      "id, nome, cpf, data_nascimento, conselho_sigla, conselho_numero, conselho_uf, email, telefone"
    )
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json(
      { disponivel: false, motivo: "sem_cadastro" },
      { status: error ? 500 : 404 }
    )
  }

  const prescritor: Prescritor = {
    id: data.id,
    nome: data.nome,
    cpf: data.cpf,
    dataNascimento: data.data_nascimento,
    conselhoSigla: data.conselho_sigla,
    conselhoNumero: data.conselho_numero,
    conselhoUf: data.conselho_uf,
    email: data.email,
    telefone: data.telefone,
  }

  // Responde ANTES de chamar a Memed quando o cadastro está incompleto: a
  // mensagem que interessa ao médico é qual campo falta, não o erro que a
  // Memed devolveria por causa dele.
  const falta = camposFaltando(prescritor)

  try {
    const token = await tokenDoPrescritor(prescritor)
    return NextResponse.json({ disponivel: true, token, scriptUrl: cfg.scriptUrl })
  } catch (err: any) {
    if (err instanceof MemedIndisponivel) {
      console.error("[memed] token:", err.message)
      // `dadosFaltando` só sai quando o cadastro é REALMENTE a causa. Quando a
      // Memed está fora do ar, mandar a lista junto faz a tela dizer "peça à
      // administração da clínica para completar seu cadastro" — instrução
      // errada, que joga o médico no canal de suporte errado enquanto o
      // problema está do outro lado. O cadastro incompleto continua sendo dito,
      // mas como observação, não como causa.
      const foiCadastro = err.dadosFaltando.length > 0
      return NextResponse.json(
        {
          disponivel: false,
          motivo: foiCadastro ? "cadastro_incompleto" : "erro",
          erro: err.message,
          dadosFaltando: foiCadastro ? err.dadosFaltando : [],
          cadastroIncompleto: foiCadastro ? [] : falta,
        },
        { status: 200 }
      )
    }
    console.error("[memed] token inesperado:", err)
    return NextResponse.json(
      { disponivel: false, motivo: "erro", erro: "Não foi possível falar com a Memed." },
      { status: 200 }
    )
  }
}

/**
 * Registra a receita emitida.
 *
 * Chamado pelo listener de `prescricaoImpressa`. Não valida o conteúdo da
 * receita — quem assina o documento é a Memed, e nosso registro é comprovante,
 * não segunda via. A RPC de 0026 é idempotente por `memed_uuid` porque este
 * evento pode chegar duas vezes.
 */
export async function POST(req: Request) {
  const supabase = clienteDoUsuario(req)
  if (!supabase) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 })
  }

  let corpo: any
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 })
  }

  const memedUuid = String(corpo?.memedUuid ?? "").trim()
  if (!memedUuid) {
    return NextResponse.json({ erro: "Receita sem identificador." }, { status: 400 })
  }

  const { data, error } = await supabase
    .rpc("record_prescription", {
      p_memed_uuid: memedUuid,
      p_memed_id: corpo?.memedId ? String(corpo.memedId) : null,
      p_medical_record_id: corpo?.recordId ?? null,
      p_medicamentos: Array.isArray(corpo?.medicamentos) ? corpo.medicamentos : [],
      p_documentos: Array.isArray(corpo?.documentos) ? corpo.documentos : [],
    })
    .single()

  if (error) {
    console.error("[memed] registro da receita:", error)
    return NextResponse.json({ erro: "Não foi possível registrar a receita." }, { status: 502 })
  }

  return NextResponse.json({ id: (data as any).id })
}
