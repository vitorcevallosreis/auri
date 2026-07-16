# Plano 2 — Evolution API self-host + Ingress de WhatsApp (implementação)

> Deriva de `docs/superpowers/specs/2026-07-15-plano2-evolution-ingress-design.md`.
> Branch: `feat/plan2-evolution-ingress` (base `main`, já com Plano 1). Estilo subagent-driven, como no Plano 1.
> **Legenda:** 🟢 codável hoje (sem VPS vivo, verificável local) · 🔵 precisa do VPS (fase live / tarefa do usuário).

## Objetivo

Reconstruir o gateway de WhatsApp como infra nossa: Evolution API v2.3.7 self-hosted num VPS + rotas de
ingress/envio/gestão-de-canal no Next.js, gravando no Supabase via service role, com o Realtime
atualizando a inbox. Escopo = **só o gateway** (sem IA — isso é o Plano 3). Ingress de **texto** primeiro
(mídia é fase 2, depende da decisão de storage).

## Pré-requisito

- **P2.0 🟢 Fix do build de produção (pré-existente).** `npm run build` quebra no prerender estático de
  `/(private)/page` (contexts Supabase/auth em build time). Aplicar `export const dynamic = "force-dynamic"`
  no layout privado (`src/app/(private)/layout.tsx`) — ou o mínimo que force a árvore privada a ser dinâmica.
  **Verif:** `npm run build` passa. (Diagnóstico: não é regressão do Plano 1; ver task tracker #9.)

## Tarefas — codável hoje (🟢)

- **P2.1 🟢 Migration `0011_whatsapp_ingress.sql` + teste.**
  - `create index idx_channels_instancewpp on myia_channels("instanceWpp");`
  - `create unique index uq_messages_instance_msgid on myia_messages(instance_id, message_id) where message_id is not null;`
  - Teste `supabase/tests/0011_whatsapp_ingress.test.sql`: índices existem; insert duplicado de
    `(instance_id, message_id)` viola o único (prova de dedup).
  - **Verif:** `node scripts/db-test.mjs supabase/tests/0011_whatsapp_ingress.test.sql` (PASS = 0 linhas).
    Aplicar com `npx supabase db push` (projeto dev) só depois do teste passar.

- **P2.2 🟢 Env scaffolding.** Adicionar a `.env.example` (e placeholders em `.env.local`):
  `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` (global, server-only), `EVOLUTION_WEBHOOK_SECRET`.
  Nenhuma com prefixo `NEXT_PUBLIC_`.

- **P2.3 🟢 Rota de ingress `src/app/api/whatsapp/ingress/route.ts`** (service role, `supabaseServer`):
  1. Rejeita **401** se `X-Auri-Webhook-Secret` ≠ `EVOLUTION_WEBHOOK_SECRET`.
  2. Só trata `event === "messages.upsert"`; ignora `data.key.fromMe === true` e `remoteJid` terminando em
     `@g.us` (grupos) → responde 200 (ack sem gravar).
  3. Resolve tenant: `myia_channels.instanceWpp === payload.instance` → `assistant_id` → `company_id`.
     Instância desconhecida → 200 + log (não 500).
  4. Upsert `myia_contacts` por (`company_id`, `remote_jid`); nome = `pushName`, `number` = `remoteJid.split("@")[0]`.
  5. Upsert `myia_chat` por (`company_id`, `instance_id`, `contact_id`); set `last_message`, `channel_name`.
  6. Insert `myia_messages` **idempotente** (`on conflict (instance_id, message_id) do nothing`): `from_me=false`,
     `message_id=data.key.id`, `key=data.key`, `message=data.message`, `message_type=data.messageType`,
     `message_timestamp=data.messageTimestamp`, `instance_id=payload.instance`, `status="RECEIVED"`.
  7. Responde **200 rápido**; texto = `data.message.conversation ?? data.message.extendedTextMessage?.text`.
  - **Verif (sem VPS):** `curl -XPOST localhost:3000/api/whatsapp/ingress -H "X-Auri-Webhook-Secret: <dev>"
    -H 'Content-Type: application/json' -d @fixtures/messages-upsert.json` (payload de exemplo da spec §3.3
    do research, ajustado pra uma `instanceWpp` de um canal seed). Conferir: linha em `myia_messages` com
    `company_id` correto; 2º POST idêntico → **não** duplica; header errado → 401; `fromMe:true`/`@g.us` → 200 sem gravar.

- **P2.4 🟢 Envio direto ao Evolution em `src/app/api/messages/send/route.ts`.**
  - **Corrigir o lookup de canal** (bug latente): remover o join `channel:channel_id(...)`; buscar
    `myia_channels` por `instanceWpp = myia_chat.instance_id` (ou por `assistant`/`company`). Reusar os
    campos `urlapi`, `token`, `instanceWpp`, `remoteJid`.
  - Trocar o `fetch` do n8n (`webhooks.sejanexa.com.br/webhook/myia-send-message`) por
    `POST {urlapi}/message/sendText/{instanceWpp}` header `apikey: {token}` body `{ number, text }`
    (para texto; mídia depois). Manter fire-and-forget + atualizar `myia_messages.status` (SENT/FAILED).
  - **Verif:** unit/manual — com Evolution mockado (ou `EVOLUTION_API_URL` apontando pra um stub local),
    confirmar a chamada certa e o update de status. Sem stub: revisão + typecheck.

- **P2.5 🟢 Gestão de instância (server) + religar UI de Channels.**
  - `src/app/api/whatsapp/instance/route.ts` (ou create/connect/logout/delete): server-only, usa
    `EVOLUTION_API_URL`+`EVOLUTION_API_KEY` (global), chama Evolution `/instance/create` (com bloco
    `webhook` embutido apontando pra nossa ingress + header secreto), `/instance/connect/{i}`,
    `/instance/logout/{i}`, `/instance/delete/{i}`. Persiste `token/instanceWpp/qrcode64/pairing_code/status`
    em `myia_channels` (service role). `instanceWpp = "auri_" + channel.id.replace(/-/g,"")`.
  - Reescrever `src/services/ChannelService.ts` → cliente fino que chama essas rotas Next (não mais o n8n).
  - Religar `src/app/(private)/assistants/[assistant_id]/Channels/{model.ts,view.tsx}` (já consomem
    `ChannelService`): criar canal → mostrar QR (`qrcode64`)/pairing → status via polling de
    `/instance/connectionState` ou Realtime de `myia_channels`.
  - **Verif (sem VPS):** typecheck/build; fluxo de UI só valida de verdade com VPS (🔵).

- **P2.6 🟢 Doc de deploy do VPS `docs/deploy/evolution-vps.md`.** Docker Compose (Evolution v2.3.7 +
  Postgres 15 + Redis 7, portas no loopback), `.env` (com `AUTHENTICATION_API_KEY` forte,
  `TELEMETRY_ENABLED=false`, save-data mínimo p/ LGPD), nginx + Let's Encrypt, ufw (80/443/22 só),
  passo-a-passo de subida e smoke test. Fonte: `agent2-evolution-research.md`.

## Tarefas — precisam do VPS (🔵, fase live / usuário)

- **P2.7 🔵 Provisionar VPS** (🔸DECISÃO 8: Contabo São Paulo 8 GB p/ LGPD-BR, ou Hetzner CX22 4 GB mais
  barato — **usuário confirma**). Rodar o compose, nginx+TLS, firewall.
- **P2.8 🔵 Criar instância real + parear** (QR/pairing) para um número de teste; setar `EVOLUTION_API_*`
  reais no `.env.local`.
- **P2.9 🔵 Teste ponta-a-ponta ao vivo:** mensagem do celular → aparece na inbox (ingress); responder pela
  inbox → chega no celular (envio); desconectar → `connection.update` reflete status.

## Ordem de execução & concorrência

Base branch `feat/plan2-evolution-ingress`. **Um único checkout compartilhado** → paralelizar via git
worktrees em arquivos disjuntos, senão serializar. Sugestão de verticais disjuntas:
- **Vertical A (inbound/foundation):** P2.0 build fix, P2.1 migration, P2.2 env, P2.3 ingress. Toca:
  layout privado, migrations/tests, nova rota ingress, `.env.example`.
- **Vertical B (outbound/channel/doc):** P2.4 send, P2.5 instância+UI, P2.6 deploy doc. Toca: `send/route.ts`,
  `ChannelService.ts`, novas rotas instance, Channels UI, doc. **Sem overlap de arquivo com A.**
Integrar A e B na branch, rodar `db-test` + `npm run build`, commitar.

## Verificação final (do que é verificável sem VPS)

- `for t in supabase/tests/*.test.sql; do node scripts/db-test.mjs "$t"; done` → 11/11.
- `npm run build` limpo.
- `curl` de ingress: grava, dedupe, 401, drop de grupo/fromMe (P2.3).
- Revisão de `send/route.ts` e rotas de instância (chamada Evolution correta), sem regressão de tipos.
