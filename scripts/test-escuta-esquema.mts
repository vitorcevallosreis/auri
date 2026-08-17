#!/usr/bin/env node --experimental-strip-types
/**
 * Testes do esquema de saída da redação (`esquemaDoTemplate`).
 * Uso: node --experimental-strip-types --test scripts/test-escuta-esquema.mts
 *
 * POR QUE ISTO EXISTE.
 *
 * Em 14/08/2026 a sessão de escuta `7adc72ae` falhou em produção com
 *
 *   jsonschema: '/phototype' does not validate ...
 *
 * e o rascunho de uma consulta inteira se perdeu. A causa não estava na
 * transcrição nem no provedor: duas regras nossas se contradiziam.
 *
 *   1. O prompt manda deixar VAZIO o campo que a consulta não cobriu — um
 *      campo em branco é honesto, um campo preenchido por hábito vira registro
 *      clínico falso.
 *   2. Todo campo do modelo entra em `required`, para o rascunho nunca chegar
 *      com chave faltando.
 *
 * Num campo `select` o enum listava só as opções clínicas. A consulta que não
 * falou de fototipo obrigava o modelo a devolver "", e "" não estava lá. Com
 * decodificação restrita (`strict: true`) o provedor não devolve um campo
 * torto — ele recusa a geração inteira.
 *
 * A correção (incluir "" no enum) é de uma linha, e é exatamente o tipo de
 * linha que alguém "limpa" depois por parecer supérflua. Daí o teste.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

const { esquemaDoTemplate } = await import("../src/lib/escuta/redacao.ts")

type Campo = Parameters<typeof esquemaDoTemplate>[0][number]

/** Os campos reais do modelo "Avaliação dermatológica" (migration 0023). */
const DERMATO: Campo[] = [
  { key: "chief_complaint", label: "Queixa principal", type: "textarea" },
  { key: "lesion_time", label: "Tempo de evolução", type: "text" },
  { key: "lesion_description", label: "Descrição da lesão", type: "textarea" },
  { key: "dermatoscopy", label: "Dermatoscopia", type: "textarea" },
  {
    key: "phototype",
    label: "Fototipo (Fitzpatrick)",
    type: "select",
    options: ["I", "II", "III", "IV", "V", "VI"],
  },
  { key: "assessment", label: "Hipótese diagnóstica", type: "textarea" },
  { key: "plan", label: "Conduta", type: "textarea" },
]

test('campo select aceita "" — foi o que perdeu uma consulta em produção', () => {
  const esquema = esquemaDoTemplate(DERMATO) as any
  const fototipo = esquema.properties.phototype

  assert.ok(fototipo.enum, "o campo select tem de virar enum")
  assert.ok(
    fototipo.enum.includes(""),
    'sem "" no enum, uma consulta que não falou de fototipo derruba a redação inteira'
  )
})

test("as opções clínicas continuam todas lá", () => {
  const esquema = esquemaDoTemplate(DERMATO) as any
  for (const opcao of ["I", "II", "III", "IV", "V", "VI"]) {
    assert.ok(
      esquema.properties.phototype.enum.includes(opcao),
      `a opção ${opcao} sumiu do enum`
    )
  }
})

test("todo campo do modelo é obrigatório", () => {
  const esquema = esquemaDoTemplate(DERMATO) as any
  // Campo ausente e campo vazio são coisas diferentes para a tela: um some sem
  // explicação, o outro diz "Não registrado neste atendimento".
  assert.deepEqual(esquema.required.sort(), DERMATO.map((c) => c.key).sort())
  assert.equal(esquema.additionalProperties, false)
})

test("campo de texto NÃO ganha enum", () => {
  const esquema = esquemaDoTemplate(DERMATO) as any
  assert.equal(esquema.properties.assessment.enum, undefined)
  assert.equal(esquema.properties.assessment.type, "string")
})

test("select sem opções cai para texto livre", () => {
  // Um modelo da clínica pode ter sido salvo com `type: "select"` e nenhuma
  // opção. Enum vazio é esquema inválido e recusaria toda redação daquele
  // modelo — melhor tratar como texto.
  const esquema = esquemaDoTemplate([
    { key: "vazio", label: "Sem opções", type: "select", options: [] },
  ] as Campo[]) as any
  assert.equal(esquema.properties.vazio.enum, undefined)
})

test("a descrição junta rótulo e dica — é o que orienta o modelo", () => {
  const esquema = esquemaDoTemplate([
    { key: "x", label: "Rótulo", type: "text", hint: "Dica" },
  ] as Campo[]) as any
  assert.equal(esquema.properties.x.description, "Rótulo — Dica")
})
