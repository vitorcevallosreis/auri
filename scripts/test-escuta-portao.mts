#!/usr/bin/env node --experimental-strip-types
/**
 * Testes do portão da escuta (`escutaDisponivel`) e das duas pendências.
 * Uso: node --experimental-strip-types --test scripts/test-escuta-portao.mts
 *
 * POR QUE ISTO EXISTE.
 *
 * `escutaDisponivel()` é consultado ANTES de o microfone ligar. Quando ele
 * responde "sim" e a transcrição não está de fato configurada, o médico conduz
 * a consulta inteira confiando na escuta e só descobre o problema ao encerrar
 * — e a consulta não se repete. O custo de um falso positivo aqui é uma
 * consulta clínica perdida, então o portão é a coisa mais barata de testar e a
 * mais cara de errar.
 *
 * O caso 1 abaixo é uma REGRESSÃO REAL: a versão anterior checava
 * `TRANSCRICAO_API_KEY && ANTHROPIC_API_KEY` e não olhava o provedor, então um
 * nome de provedor errado passava no portão.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

// Cada módulo é importado direto. `disponibilidade.ts` não entra porque o
// carregador do node exige extensão explícita em import relativo, e o código
// da aplicação usa o resolvedor do bundler — a composição que ela faz é
// `transcricaoPendencia() === null && redacaoPendencia() === null`, e é
// exatamente isso que `portaoAberto()` abaixo repete.
const { transcricaoPendencia } = await import("../src/lib/escuta/transcricao.ts")
const { redacaoPendencia } = await import("../src/lib/escuta/redacao.ts")

const escutaDisponivel = () =>
  transcricaoPendencia() === null && redacaoPendencia() === null

const CHAVES = [
  "TRANSCRICAO_PROVIDER",
  "TRANSCRICAO_API_KEY",
  "TRANSCRICAO_BASE_URL",
  "ESCUTA_PROVIDER",
  "ESCUTA_API_KEY",
  "ESCUTA_BASE_URL",
  "ANTHROPIC_API_KEY",
]

/** Aplica uma configuração limpa — sem herdar sobra de teste anterior. */
function configurar(env: Record<string, string>) {
  for (const k of CHAVES) delete process.env[k]
  Object.assign(process.env, env)
}

test("provedor de transcrição inexistente NÃO passa no portão", () => {
  // A regressão. Com a chave presente, a versão antiga dizia "disponível".
  configurar({
    TRANSCRICAO_PROVIDER: "whisper-que-nao-existe",
    TRANSCRICAO_API_KEY: "k",
    ANTHROPIC_API_KEY: "k",
  })
  assert.equal(escutaDisponivel(), false)
  assert.match(transcricaoPendencia()!, /desconhecido/)
  // A mensagem precisa listar as opções: quem configurou errou o nome e é
  // isso que resolve o problema dele.
  assert.match(transcricaoPendencia()!, /deepgram/)
})

test("Whisper na rede interna dispensa chave, mas exige endereço", () => {
  // O arranjo escolhido para validação: áudio não sai do nosso servidor.
  configurar({
    TRANSCRICAO_PROVIDER: "openai-compat",
    TRANSCRICAO_BASE_URL: "http://auri-whisper:8000/v1",
    ESCUTA_PROVIDER: "openai-compat",
    ESCUTA_BASE_URL: "https://api.groq.com/openai/v1",
  })
  assert.equal(transcricaoPendencia(), null, "sem chave é válido aqui")
  assert.equal(redacaoPendencia(), null)
  assert.equal(escutaDisponivel(), true)

  // Sem o endereço, não há para onde mandar o áudio.
  delete process.env.TRANSCRICAO_BASE_URL
  assert.match(transcricaoPendencia()!, /TRANSCRICAO_BASE_URL/)
  assert.equal(escutaDisponivel(), false)
})

test("deepgram continua exigindo chave", () => {
  configurar({ TRANSCRICAO_PROVIDER: "deepgram", ANTHROPIC_API_KEY: "k" })
  assert.match(transcricaoPendencia()!, /TRANSCRICAO_API_KEY/)
  assert.equal(escutaDisponivel(), false)

  process.env.TRANSCRICAO_API_KEY = "k"
  assert.equal(transcricaoPendencia(), null)
  assert.equal(escutaDisponivel(), true)
})

test("o padrão sem nenhuma variável é DESLIGADO", () => {
  // Instalação recém-clonada não pode oferecer escuta.
  configurar({})
  assert.equal(escutaDisponivel(), false)
})

test("uma ponta pronta não liga a escuta", () => {
  // Transcrição ok, redação não: gravar aqui produz áudio sem prontuário.
  configurar({
    TRANSCRICAO_PROVIDER: "openai-compat",
    TRANSCRICAO_BASE_URL: "http://auri-whisper:8000/v1",
  })
  assert.equal(transcricaoPendencia(), null)
  assert.match(redacaoPendencia()!, /ANTHROPIC_API_KEY/)
  assert.equal(escutaDisponivel(), false)
})

test("provedor de redação inexistente NÃO passa no portão", () => {
  configurar({
    TRANSCRICAO_PROVIDER: "openai-compat",
    TRANSCRICAO_BASE_URL: "http://auri-whisper:8000/v1",
    ESCUTA_PROVIDER: "ollama-imaginario",
  })
  assert.match(redacaoPendencia()!, /desconhecido/)
  assert.equal(escutaDisponivel(), false)
})

test("anthropic segue sendo o padrão quando ESCUTA_PROVIDER não é dito", () => {
  // Garante que a costura não trocou o alvo de escala por engano.
  configurar({
    TRANSCRICAO_PROVIDER: "deepgram",
    TRANSCRICAO_API_KEY: "k",
    ESCUTA_BASE_URL: "https://api.groq.com/openai/v1",
  })
  // Sem ESCUTA_PROVIDER, a URL do Groq é ignorada e a chave da Anthropic é o
  // que falta — se este teste inverter, alguém mudou o padrão sem querer.
  assert.match(redacaoPendencia()!, /ANTHROPIC_API_KEY/)
})
