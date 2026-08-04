import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getTranscritor, TranscricaoIndisponivel } from "@/lib/escuta/transcricao"
import { escutaDisponivel } from "@/lib/escuta/disponibilidade"
import { redigirRascunho, RedacaoIndisponivel } from "@/lib/escuta/redacao"
import type { TemplateField } from "@/hooks/useMedicalRecords"

// A transcrição de uma consulta inteira mais a redação passam de 30s. Sem isto
// a rota é cortada no meio e o médico perde o atendimento gravado.
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
 * O ÁUDIO NÃO É GRAVADO EM DISCO. Chega no corpo da requisição, vai para o
 * transcritor e sai do processo. Nada o escreve em lugar nenhum.
 */
function clienteDoUsuario(req: Request) {
  const authz = req.headers.get("authorization") || ""
  const token = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7).trim() : ""
  if (!token) return null

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  if (!campos.length) {
    await marcarFalha(supabase, sessionId, "O modelo de prontuário não tem campos.")
    return NextResponse.json({ erro: "O modelo de prontuário não tem campos." }, { status: 400 })
  }

  const appt: any = Array.isArray((sessao as any).myia_appointments)
    ? (sessao as any).myia_appointments[0]
    : (sessao as any).myia_appointments
  const svc = appt && (Array.isArray(appt.myia_services) ? appt.myia_services[0] : appt.myia_services)

  // ------------------------------------------------------------------ transcrição
  let transcricao: string
  try {
    await supabase.rpc("update_listening_session", {
      p_session_id: sessionId,
      p_status: "transcribing",
    })
    const r = await getTranscritor().transcrever(audio, { idioma: "pt-BR" })
    transcricao = r.texto
  } catch (err: any) {
    const msg =
      err instanceof TranscricaoIndisponivel ? err.message : "A transcrição falhou."
    console.error("[escuta] transcrição:", msg, err)
    await marcarFalha(supabase, sessionId, msg)
    return NextResponse.json({ erro: msg }, { status: 502 })
  }

  // ------------------------------------------------------------------ redação
  try {
    // A transcrição é gravada ANTES da redação. Se o modelo falhar depois, o
    // médico ainda tem o texto da consulta — que é o que não dá para refazer.
    await supabase.rpc("update_listening_session", {
      p_session_id: sessionId,
      p_status: "drafting",
      p_transcript: transcricao,
    })

    const { content, modelo } = await redigirRascunho(transcricao, campos, {
      paciente: appt?.cliente_nome ?? null,
      servico: svc?.name ?? null,
    })

    const { data: registro, error: finErr } = await supabase
      .rpc("finish_listening_session", {
        p_session_id: sessionId,
        p_content: content,
        p_ai_model: modelo,
      })
      .single()

    if (finErr) throw finErr

    return NextResponse.json({ recordId: (registro as any).id })
  } catch (err: any) {
    const msg =
      err instanceof RedacaoIndisponivel
        ? err.message
        : err?.code === "23505"
          ? "Este atendimento já tem prontuário."
          : "A redação do rascunho falhou."
    console.error("[escuta] redação:", msg, err)
    await marcarFalha(supabase, sessionId, msg)
    // 409 quando o conflito é de estado — a tela oferece abrir o que já existe
    // em vez de mandar tentar de novo, que nunca funcionaria.
    return NextResponse.json({ erro: msg, transcricao }, { status: err?.code === "23505" ? 409 : 502 })
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
