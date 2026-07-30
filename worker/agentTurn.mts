import type { AgentJob } from "./queue.mts"

/**
 * Execução de um turno do agente.
 *
 * ⚠️ STUB — o turno de verdade é o P3.3. Esta fase (P3.2) entrega a fila, o
 * debounce e o worker; o que falta aqui é: montar o system prompt cacheado a
 * partir do assistente, ler o histórico de myia_messages, chamar
 * client.beta.messages.toolRunner() com as tools de agendamento, gravar a
 * resposta e enviar pelo canal.
 *
 * Este arquivo é o único ponto que o P3.3 precisa preencher — o resto do worker
 * não muda.
 *
 * Por que NÃO responde nada por enquanto: marcar o job como concluído sem
 * responder faria o paciente ficar no vácuo e o job sumir da fila. Enquanto o
 * turno não existe, o comportamento correto é o worker nem rodar em produção
 * (AGENT_TURN_ENABLED=false, o default) — a mensagem já chega na inbox por
 * Realtime e um humano responde.
 */

export interface TurnResult {
  /** Só para log/observabilidade nesta fase. */
  summary: string
}

export async function processAgentTurn(job: AgentJob): Promise<TurnResult> {
  if (!job.assistant_id) {
    // Canal conectado mas sem agente vinculado. Não é erro: a conversa fica na
    // inbox para atendimento humano.
    return { summary: "sem assistente vinculado — nada a fazer" }
  }

  throw new Error(
    "turno do agente ainda não implementado (P3.3). " +
      "Rode o worker com AGENT_TURN_ENABLED=false até lá.",
  )
}
