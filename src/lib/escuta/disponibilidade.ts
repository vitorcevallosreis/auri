import { transcricaoPendencia } from "./transcricao"
import { redacaoPendencia } from "./redacao"

/**
 * A escuta só é oferecida quando as DUAS pontas estão prontas.
 *
 * Mora num módulo próprio porque não pertence a nenhuma delas: transcrever e
 * redigir são independentes, e fazer uma importar a outra só para responder
 * esta pergunta acoplaria as duas de graça.
 *
 * PERGUNTA AOS PROVEDORES em vez de checar variáveis fixas. A versão anterior
 * era `TRANSCRICAO_API_KEY && ANTHROPIC_API_KEY`, com dois defeitos:
 *
 *   1. não validava `TRANSCRICAO_PROVIDER`. Com um nome errado o portão dizia
 *      "disponível", o médico conduzia a consulta inteira confiando na escuta
 *      e só ao encerrar descobria que o provedor não existe. A consulta não se
 *      repete — era a falha exata que este portão existe para evitar;
 *   2. amarrava a instalação a um arranjo só. Com o Whisper na nossa própria
 *      rede não há chave de transcrição, e com um redator que não seja a
 *      Anthropic não há `ANTHROPIC_API_KEY`: a escuta ficaria desligada para
 *      sempre, sem dizer por quê.
 *
 * Coberto por scripts/test-escuta-portao.mts.
 */
export function escutaDisponivel(): boolean {
  return transcricaoPendencia() === null && redacaoPendencia() === null
}

/** As pendências em aberto, para quem precisa DIZER o que falta. */
export function escutaPendencias(): string[] {
  return [transcricaoPendencia(), redacaoPendencia()].filter(
    (p): p is string => p !== null
  )
}
