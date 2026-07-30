import { supabaseServer } from "./supabase.mts"

/**
 * Acesso à fila de turnos do agente (migration 0014).
 *
 * Toda a lógica de concorrência mora no Postgres — claim atômico com
 * `for update skip locked`, coalescência por chat, backoff, reaper. Este módulo
 * é só a casca de RPC. Se alguma regra de fila parecer estar faltando aqui, ela
 * está na migration, não sumiu.
 */

export interface AgentJob {
  id: string
  company_id: string
  chat_id: string
  assistant_id: string | null
  status: string
  run_after: string
  attempts: number
  max_attempts: number
  locked_at: string | null
  locked_by: string | null
  last_error: string | null
}

export async function claimJobs(
  workerId: string,
  limit: number,
): Promise<AgentJob[]> {
  const { data, error } = await supabaseServer.rpc("myia_claim_agent_jobs", {
    p_worker_id: workerId,
    p_limit: limit,
  })

  if (error) throw new Error(`claim falhou: ${error.message}`)

  return (data ?? []) as AgentJob[]
}

export async function finishJob(
  jobId: string,
  ok: boolean,
  errorMessage?: string,
): Promise<void> {
  const { error } = await supabaseServer.rpc("myia_finish_agent_job", {
    p_job_id: jobId,
    p_ok: ok,
    p_error: errorMessage ?? null,
  })

  // Falhar aqui é grave: o job fica preso em 'running' até o reaper. Logamos
  // alto e deixamos o reaper resolver, em vez de derrubar o worker.
  if (error) {
    console.error(`[worker] finish falhou para o job ${jobId}:`, error.message)
  }
}

export async function reapStaleJobs(timeoutSeconds: number): Promise<number> {
  const { data, error } = await supabaseServer.rpc(
    "myia_reap_stale_agent_jobs",
    { p_timeout_seconds: timeoutSeconds },
  )

  if (error) {
    console.error("[worker] reap falhou:", error.message)
    return 0
  }

  return (data as number) ?? 0
}
