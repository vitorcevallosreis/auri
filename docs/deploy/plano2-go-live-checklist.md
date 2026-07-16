# Checklist de Go-Live — Plano 2 (gateway de WhatsApp / Evolution API)

Checklist linear para colocar o gateway de WhatsApp no ar. Faça na ordem, marcando
cada caixa. O código do app (rotas de ingress/send/instância) já está pronto e
build-verificado na branch `feat/plan2-evolution-ingress`; o que falta é a **fase
live** (VPS + pareamento) e o hardening final.

> Runbook do VPS: [`docs/deploy/evolution-vps.md`](./evolution-vps.md)
> Smoke-test: `scripts/whatsapp-golive-check.mjs`

---

## 0. Pré-requisitos

- [ ] Branch `feat/plan2-evolution-ingress` revisada e **mergeada na `main`** (ou o
      alvo de deploy do app).
- [ ] App Next **deployado** e acessível numa URL pública HTTPS (será o
      `NEXT_PUBLIC_APP_URL`). O Evolution precisa alcançar `/api/whatsapp/ingress`
      pela internet.
- [ ] Migrations aplicadas no Supabase de produção (inclui `0011_whatsapp_ingress`).

## 1. Subir o Evolution API no VPS

- [ ] Seguir o runbook [`docs/deploy/evolution-vps.md`](./evolution-vps.md) de ponta
      a ponta: VPS + hardening (ufw 22/80/443), Docker Compose (Evolution v2.3.7 +
      Postgres 15 + Redis 7), nginx + Let's Encrypt (TLS).
- [ ] Definir uma `AUTHENTICATION_API_KEY` forte no `.env` do Evolution (= a
      `EVOLUTION_API_KEY` do app).
- [ ] Definir o secret do webhook no `.env` do Evolution (= a
      `EVOLUTION_WEBHOOK_SECRET` do app) — o mesmo dos dois lados.
- [ ] Smoke test do próprio VPS (do runbook): `GET https://evo.SEUDOMINIO/` com
      header `apikey` retorna `version: 2.3.7`.

## 2. Configurar as envs do app (`.env.local` de produção)

Todas **server-only**, exceto a URL pública. Sem `NEXT_PUBLIC_` nas 3 primeiras.

- [ ] `EVOLUTION_API_URL` = base URL pública do Evolution (ex.: `https://evo.SEUDOMINIO.com.br`)
- [ ] `EVOLUTION_API_KEY` = a `AUTHENTICATION_API_KEY` global do Evolution
- [ ] `EVOLUTION_WEBHOOK_SECRET` = o mesmo secret do header `X-Auri-Webhook-Secret`
- [ ] `NEXT_PUBLIC_APP_URL` = URL pública do app (ex.: `https://app.SEUDOMINIO.com.br`)
- [ ] Redeploy/restart do app para carregar as envs.

## 3. Rodar o smoke-test (exigir tudo verde)

```bash
node scripts/whatsapp-golive-check.mjs
```

- [ ] Passo 1 (Health) **PASS** e imprime `Evolution v2.3.7`.
- [ ] Passo 2 (Create) **PASS** (retorna `hash` e `qrcode.base64`).
- [ ] **Passo 3 (Webhook persistido) PASS** — este é o ponto crítico. Ele confirma,
      via `GET /webhook/find/{instance}`, que o `/instance/create` **realmente
      persistiu** nosso webhook (url + eventos + header).
      - ⚠️ **Caveat:** em algumas versões o `/instance/create` ignora o bloco
        `webhook` (diferença `byEvents/base64` vs `webhookByEvents/webhookBase64`).
        Se o passo 3 **FALHAR**, o script imprime o `curl` de
        `POST /webhook/set/{instance}` com o envelope `{ webhook: {...} }`. Nesse
        caso, ajuste `src/app/api/whatsapp/instance/route.ts` (`handleCreate`) para
        chamar `/webhook/set` logo após o `/instance/create`, e rode o smoke-test de
        novo até ficar verde.
- [ ] Passo 4 (connectionState) **PASS** (imprime o state).
- [ ] Passo 5 (Cleanup) **PASS** (instância descartável removida).
- [ ] Resumo final: **TUDO VERDE ✓** (exit code 0).

## 4. Criar um canal real pela UI e parear

- [ ] No painel: **Assistants → (um assistant) → Channels → criar canal**.
- [ ] O modal de QR abre com o `qrcode64`. Escanear com o WhatsApp do número de teste
      (Aparelhos conectados → Conectar aparelho).
- [ ] Status do canal vira conectado (`open`). Se o QR expirar, usar "gerar QR"
      novamente (connect).

## 5. Teste end-to-end (texto)

- [ ] **Inbound (ingress):** enviar uma mensagem do celular para o número pareado →
      ela aparece na **inbox** do painel (via webhook `messages.upsert` →
      `/api/whatsapp/ingress` → Supabase → Realtime).
- [ ] **Outbound (send):** responder pela inbox do painel → a mensagem chega no
      celular (via `/api/messages/send` → `POST /message/sendText/{instance}`), e o
      status da mensagem vira `SENT`.
- [ ] Conferir que o tenant está correto (a mensagem caiu na empresa dona do canal).

## 6. Hardening final (task #14) antes de escalar

- [ ] **#14 — mover `MessageService` para o servidor:** hoje o client lê
      `myia_channels.token`/`urlapi` e fala com o Evolution direto do browser
      (expõe segredo de instância). Mover essa chamada para uma rota server-only
      (com auth/tenant, como já foi feito em `/api/whatsapp/instance` e
      `/api/messages/send`).
- [ ] **#14 — revogar SELECT do client** nas colunas sensíveis
      `myia_channels.token`/`urlapi` (as respostas server-side já param de devolvê-las;
      falta cortar o acesso direto via RLS/grants para o role `authenticated`).

---

### Rollback rápido
Se algo der errado no ar: no VPS, `docker compose down` derruba o gateway (o app
continua de pé, só sem enviar/receber WhatsApp). Remover as envs `EVOLUTION_*` do app
desabilita as chamadas de envio/gestão (o ingress rejeita/ignora sem secret).
