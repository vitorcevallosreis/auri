#!/usr/bin/env node --experimental-strip-types
/**
 * Testes do secretBox (AES-256-GCM) — Plano 3, P3.1.
 * Uso: node --experimental-strip-types --test scripts/test-secret-box.mts
 */

import { test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"

// A chave precisa existir ANTES do import: o módulo lê a env no primeiro uso.
process.env.WHATSAPP_TOKEN_ENC_KEY = randomBytes(32).toString("base64")

const { encryptSecret, decryptSecret } = await import(
  "../src/lib/crypto/secretBox.ts"
)

test("round-trip preserva o valor", () => {
  const token = "EAAG...um-access-token-longo-da-meta"
  assert.equal(decryptSecret(encryptSecret(token)), token)
})

test("preserva unicode e string vazia", () => {
  assert.equal(decryptSecret(encryptSecret("acentuação ✅")), "acentuação ✅")
  assert.equal(decryptSecret(encryptSecret("")), "")
})

test("mesmo plaintext gera ciphertexts diferentes", () => {
  // IV aleatório por chamada. Sem isso, dá para inferir que dois tenants têm o
  // mesmo token só comparando as linhas da tabela.
  assert.notEqual(encryptSecret("mesmo-valor"), encryptSecret("mesmo-valor"))
})

test("o ciphertext não contém o plaintext", () => {
  const token = "token-super-secreto"
  assert.equal(encryptSecret(token).includes(token), false)
})

test("adulteração é detectada, não devolve lixo", () => {
  // É o ponto do GCM: modo autenticado. Um ciphertext editado tem que FALHAR,
  // não decifrar para algo diferente sem avisar.
  const payload = encryptSecret("valor-original")
  const parts = payload.split(".")
  const ct = Buffer.from(parts[3], "base64url")
  ct[0] ^= 0xff
  parts[3] = ct.toString("base64url")

  assert.throws(() => decryptSecret(parts.join(".")))
})

test("authTag trocado é rejeitado", () => {
  const parts = encryptSecret("valor").split(".")
  const tag = Buffer.from(parts[2], "base64url")
  tag[0] ^= 0xff
  parts[2] = tag.toString("base64url")

  assert.throws(() => decryptSecret(parts.join(".")))
})

test("formato desconhecido é rejeitado com mensagem clara", () => {
  assert.throws(() => decryptSecret("nao-e-ciphertext"), /formato desconhecido/i)
  assert.throws(() => decryptSecret("v2.a.b.c"), /formato desconhecido/i)
})

test("chave de tamanho errado falha na hora", () => {
  // Falhar no boot é melhor que cifrar com chave fraca silenciosamente.
  assert.rejects(async () => {
    process.env.WHATSAPP_TOKEN_ENC_KEY = Buffer.from("curta").toString("base64")
    const mod = await import(
      "../src/lib/crypto/secretBox.ts?bust=" + Date.now()
    )
    mod.encryptSecret("x")
  })
})
