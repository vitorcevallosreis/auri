import { NextResponse } from "next/server"
import { mkdir, writeFile, unlink } from "node:fs/promises"
import { createClient } from "@supabase/supabase-js"
import { supabasePublishableKey } from "@/lib/supabase/keys"
import { escutaDisponivel } from "@/lib/escuta/disponibilidade"
import type { TemplateField } from "@/hooks/useMedicalRecords"

// Agora a rota só RECEBE o áudio e enfileira, então o tempo aqui é o do upload.
// Continua alto porque a consulta pode ter dezenas de MB numa conexão de
// consultório — mas o trabalho longo saiu daqui (0027).
export const maxDuration = 300
export const dynamic = "force-dynamic"

/**
 * Escuta assistida: áudio → transcrição → rascunho → prontuário.
 *
 * AUTENTICAÇÃO. O middleware EXCLUI `/api/*` e o cookie `authData` não é
 * assinado — a identidade vem do JWT do Supabase no `Authorization: Bearer`.
 * Aqui a rota NÃO usa service role: cria um cliente com o token do próprio
 * médico, então as RPCs de 0025 enxergam `auth.uid()` e todas as checagens de
 * profissional/empresa que elas fazem continuam valendo. Service role
 * desligaria justamente essas checagens e obrigaria a reimplementá-las aqui.
 *
 * O ÁUDIO É GRAVADO EM DISCO, e só até ser transcrito. Desde 0027 esta rota
 * não transcreve: ela escreve o arquivo num volume do nosso servidor,
 * enfileira e responde 202. Quem apaga é o worker, assim que termina — e a
 * varredura de 0027 cobre o caso de ele morrer no meio.
 *
 * (Até 0026 este comentário dizia que nada escrevia o áudio em lugar nenhum.
 * Era verdade enquanto a transcrição acontecia dentro da requisição.)
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

/** Diz à tela se a escuta pode sequer ser oferecida, antes de ligar o microfone. */
export async function GET() {
  return NextResponse.json({ disponivel: escutaDisponivel() })
}

export async function POST(req: Request) {
  const supabase = clienteDoUsuario(req)
  if (!supabase) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 })
  }

  const sessionId = String(form.get("sessionId") ?? "")
  const audio = form.get("audio")

  if (!sessionId || !(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ erro: "Sessão ou áudio ausente." }, { status: 400 })
  }

  // A sessão é lida pelo RLS do próprio médico — um id de outra pessoa
  // simplesmente não existe daqui.
  const { data: sessao, error: sessErr } = await supabase
    .from("myia_listening_sessions")
    .select(
      "id, status, template_id, appointment_id, myia_record_templates(fields), myia_appointments(cliente_nome, myia_services(name))"
    )
    .eq("id", sessionId)
    .maybeSingle()

  if (sessErr || !sessao) {
    return NextResponse.json({ erro: "Sessão de escuta não encontrada." }, { status: 404 })
  }
  if (sessao.status === "done") {
    return NextResponse.json({ erro: "Esta escuta já gerou prontuário." }, { status: 409 })
  }

  const tpl: any = Array.isArray((sessao as any).myia_record_templates)
    ? (sessao as any).myia_record_templates[0]
    : (sessao as any).myia_record_templates
  const campos: TemplateField[] = Array.isArray(tpl?.fields) ? tpl.fields : []

  // Vale a checagem AQUI, com o médico esperando, mesmo que o worker vá
  // refazê-la: um modelo sem campos é erro de configuração da clínica, e
  // descobrir isso agora é um aviso na tela — descobrir depois é uma consulta
  // gravada que nunca vira prontuário.
  if (!campos.length) {
    await marcarFalha(supabase, sessionId, "O modelo de prontuário não tem campos.")
    return NextResponse.json({ erro: "O modelo de prontuário não tem campos." }, { status: 400 })
  }

  // ------------------------------------------------------------------ entrega
  // O áudio vai para o disco e a requisição termina. Quem transcreve é o
  // worker — ver o cabeçalho de 0027 para o porquê e para a ressalva de LGPD
  // que isso carrega.
  let caminho: string
  try {
    caminho = await guardarAudio(sessionId, audio)
  } catch (err) {
    console.error("[escuta] gravação do áudio:", err)
    await marcarFalha(supabase, sessionId, "Não consegui guardar a gravação.")
    return NextResponse.json({ erro: "Não consegui guardar a gravação." }, { status: 500 })
  }

  const { error: enqErr } = await supabase.rpc("enqueue_listening_session", {
    p_session_id: sessionId,
    p_audio_path: caminho,
  })

  if (enqErr) {
    // O arquivo não pode sobreviver a uma sessão que não entrou na fila:
    // ninguém viria apagá-lo depois.
    await apagarAudio(caminho)
    console.error("[escuta] enfileiramento:", enqErr)
    const conflito = (enqErr as any)?.code === "23505"
    return NextResponse.json(
      { erro: conflito ? "Esta escuta já gerou prontuário." : "Não consegui enfileirar a escuta." },
      { status: conflito ? 409 : 502 }
    )
  }

  // 202: aceito, ainda não pronto. A tela passa a acompanhar por `status`.
  return NextResponse.json({ sessionId, status: "queued" }, { status: 202 })
}

/**
 * Grava o áudio no volume compartilhado com o worker.
 *
 * Nome derivado do id da sessão: o worker não precisa adivinhar, e uma
 * retentativa sobrescreve em vez de acumular arquivo órfão.
 */
async function guardarAudio(sessionId: string, audio: Blob): Promise<string> {
  const dir = process.env.ESCUTA_AUDIO_DIR ?? "/dados/escuta"
  await mkdir(dir, { recursive: true })
  const caminho = `${dir}/${sessionId}.webm`
  await writeFile(caminho, Buffer.from(await audio.arrayBuffer()), { mode: 0o600 })
  return caminho
}

async function apagarAudio(caminho: string) {
  try {
    await unlink(caminho)
  } catch {
    // Já não estava lá: o objetivo era esse.
  }
}

async function marcarFalha(supabase: any, sessionId: string, motivo: string) {
  try {
    await supabase.rpc("update_listening_session", {
      p_session_id: sessionId,
      p_status: "failed",
      p_failure: motivo,
    })
  } catch (e) {
    console.error("[escuta] não consegui registrar a falha:", e)
  }
}
