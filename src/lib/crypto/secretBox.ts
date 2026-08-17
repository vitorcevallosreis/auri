import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

/**
 * Criptografia simétrica para segredos por tenant guardados no Postgres —
 * hoje o access token do WhatsApp Cloud API (myia_wa_cloud_numbers).
 *
 * Por que criptografar em vez de só depender da RLS: RLS restringe LINHA, não
 * COLUNA, e o histórico do projeto mostra que um grant amplo demais vaza
 * segredo para o browser (tracker #14, myia_channels.token). Com o valor
 * cifrado na aplicação, mesmo um SELECT indevido devolve ciphertext inútil.
 *
 * AES-256-GCM: autenticado, então adulterar o ciphertext falha na decifragem em
 * vez de devolver lixo silenciosamente.
 *
 * SERVIDOR APENAS. A chave vem de WHATSAPP_TOKEN_ENC_KEY, que nunca é
 * NEXT_PUBLIC_* — se este módulo for importado por componente de cliente, o
 * build falha ao não encontrar a env, que é o comportamento desejado.
 */

const ALGO = "aes-256-gcm"
const IV_BYTES = 12 // recomendado para GCM
const KEY_BYTES = 32 // AES-256

let cachedKey: Buffer | null = null

function getKey(): Buffer {
  if (cachedKey) return cachedKey

  const raw = process.env.WHATSAPP_TOKEN_ENC_KEY

  if (!raw) {
    throw new Error(
      "WHATSAPP_TOKEN_ENC_KEY não configurada. Gere com: openssl rand -base64 32",
    )
  }

  const key = Buffer.from(raw, "base64")

  if (key.length !== KEY_BYTES) {
    throw new Error(
      `WHATSAPP_TOKEN_ENC_KEY deve ter ${KEY_BYTES} bytes em base64 (got ${key.length}). Gere com: openssl rand -base64 32`,
    )
  }

  cachedKey = key
  return key
}

/**
 * Formato de saída: `v1.<iv>.<authTag>.<ciphertext>`, tudo base64url.
 *
 * O prefixo de versão existe para permitir rotação de chave depois sem ter que
 * adivinhar o formato de linhas antigas.
 */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, getKey(), iv)

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])

  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".")
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(".")

  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Ciphertext em formato desconhecido (esperado v1.iv.tag.ct)")
  }

  const [, ivB64, tagB64, ctB64] = parts

  const decipher = createDecipheriv(
    ALGO,
    getKey(),
    Buffer.from(ivB64, "base64url"),
  )
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"))

  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}
