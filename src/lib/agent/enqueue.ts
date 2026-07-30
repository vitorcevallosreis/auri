import { supabaseServer } from "@/lib/supabase/server"

/**
 * Enfileira um turno do agente (migration 0014). SERVIDOR APENAS.
 *
 * O debounce mora no banco, não aqui: chamar isto três vezes seguidas para o
 * mesmo chat NÃO cria três jobs — o upsert no índice parcial empurra o
 * `run_after` do job pendente para frente. É o que evita que "oi", "queria
 * marcar" e "amanhã" virem três turnos do modelo.
 */

/** Janela de coalescência. Curta demais não agrupa; longa demais o paciente sente. */
const DEFAULT_DEBOUNCE_SECONDS = Number(
  process.env.AGENT_DEBOUNCE_SECONDS ?? 3,
)

export async function enqueueAgentTurn(args: {
  companyId: string
  chatId: string
  assistantId: string | null
  debounceSeconds?: number
}): Promise<string | null> {
  const { data, error } = await supabaseServer.rpc("myia_enqueue_agent_turn", {
    p_company_id: args.companyId,
    p_chat_id: args.chatId,
    p_assistant_id: args.assistantId,
    p_debounce_seconds: args.debounceSeconds ?? DEFAULT_DEBOUNCE_SECONDS,
  })

  if (error) {
    // Não propaga: a mensagem JÁ foi gravada e aparece na inbox por Realtime.
    // Deixar o webhook falhar por causa da fila faria a Meta reentregar uma
    // mensagem que já está persistida — pior do que perder o turno automático.
    console.error("[agent/enqueue] falha ao enfileirar turno:", error.message)
    return null
  }

  return (data as string) ?? null
}
