# Spec — Plano 2: Evolution API self-host + Ingress de WhatsApp

> **Status:** Draft de design escrito autonomamente na sessão orquestrada de 2026-07-15 (revisão do
> usuário pendente). Sintetiza a engenharia reversa do código existente + pesquisa do Evolution API v2.
> **Decisões de arquitetura tomadas autonomamente estão marcadas com 🔸DECISÃO, junto da alternativa
> considerada — pontos de revisão para o usuário.** A DECISÃO 8 (VPS) precisa de confirmação explícita.

## Contexto & objetivo

O painel myia_app foi religado ao nosso Supabase no Plano 1. Mas o **gateway de WhatsApp se perdeu**:
o painel antigo falava com um n8n hospedado (`webhooks.sejanexa.com.br`) que fazia a ponte com
Evolution/Waha. O **Plano 2 reconstrói esse gateway como infra nossa**: Evolution API self-hosted num
VPS que controlamos + as rotas de ingress/envio/gestão de canal no próprio Next.js, gravando direto no
Supabase (service role) e deixando o Realtime atualizar o painel.

**Escopo do Plano 2 = só o gateway/ingress.** O "cérebro" de IA (responder, agendar, follow-ups) é o
**Plano 3** (Agent Service). Aqui, mensagem que chega é só **persistida e exibida** no painel; envio é
manual pelo operador (a inbox já existe).

**Não-objetivos:** lógica de IA/resposta automática; migração de mídia/storage (fica como fase 2 —
ingress de **texto** já destrava o produto); canal oficial Meta (WHATSAPP-BUSINESS) — usaremos Baileys.

## Fatos que embasam o desenho (do B1 + B2)

- **`myia_channels` já é o mapa instância↔tenant.** Campos existentes: `instanceWpp` (nome da
  instância Evolution), `token` (apikey/hash da instância), `urlapi` (base URL Evolution), `remoteJid`,
  `status` (`created`/`open`/`close`), `qrcode64`, `pairing_code`, `looping_qrcode`, `apiUtilizada`.
  Tenant = `myia_channels.assistant_id → myia_assistants.company_id`.
- **`myia_chat`/`myia_messages`/`myia_contacts` já usam o formato Baileys** — idêntico ao payload
  `messages.upsert` do Evolution (`key` jsonb, `message` jsonb, `message_id` com índice, `instance_id`,
  `from_me`, `message_timestamp`). Realtime já publica essas tabelas (migration 0010).
- **`src/app/api/messages/send/route.ts` já existe e usa service role** — só o "último passo" (POST pro
  n8n) precisa virar chamada direta ao Evolution. E tem um **bug latente**: faz `.select("channel:channel_id(...)")`
  mas `myia_chat` não tem coluna `channel_id` (tem `instance_id`/`channel_name`) → esse join retorna null.
- **Evolution API v2.3.7** (imagem `evoapicloud/evolution-api:v2.3.7`), Baileys, exige Postgres 15 +
  Redis. Webhook `messages.upsert` traz `instance`, `data.key{remoteJid,fromMe,id}`, `data.message`,
  `data.pushName`, `data.messageTimestamp`. Envio: `POST {url}/message/sendText/{instance}` com header
  `apikey`. Instância: `/instance/create|connect|logout|delete`.

## Arquitetura alvo

```
WhatsApp ──> Evolution API (VPS nosso, nginx+TLS) ──(webhook messages.upsert)──> 
   Next.js POST /api/whatsapp/ingress  ──(service role)──> Supabase myia_contacts/chat/messages
                                                              └─> Realtime ──> painel (inbox)

Operador no painel ──> Next.js POST /api/messages/send ──(service role: insere msg)──>
   ──(Evolution POST /message/sendText/{instance}, apikey)──> WhatsApp

Onboarding de canal: painel ──> Next.js /api/whatsapp/instance/* ──(server, apikey GLOBAL)──>
   Evolution /instance/create|connect|logout|delete  ──> grava qrcode/status em myia_channels
```

### Decisões de arquitetura

- 🔸**DECISÃO 1 — Reusar `myia_channels`, NÃO criar `wa_instances`.** O B2 sugeriu tabela nova; o B1
  mostrou que `myia_channels` já tem todos os campos. _Alternativa (rejeitada):_ tabela `wa_instances`
  separada — duplicaria o mapa e exigiria sincronizar dois lugares. _Ação:_ só adicionar **índice em
  `instanceWpp`** (lookup do webhook) e, se preciso, uma coluna `webhook_secret`.

- 🔸**DECISÃO 2 — Uma instância Evolution por canal (`myia_channels`), nome determinístico.** Convenção
  `instanceWpp = "auri_" + replace(channel.id, '-', '')` (só `[a-z0-9_]`, estável). Lookup de tenant é
  **por `myia_channels.instanceWpp` no banco** (não parsear a string). _Alternativa:_ embutir company no
  nome — desnecessário, o banco resolve.

- 🔸**DECISÃO 3 — Auth do webhook por header secreto compartilhado.** Env `EVOLUTION_WEBHOOK_SECRET`;
  setado em `webhook.headers` no create da instância; o handler rejeita 401 se `X-Auri-Webhook-Secret`
  não bater. **Reforço:** resolver `instance` no `myia_channels` e dropar se desconhecida. _Alternativa
  (futuro):_ HMAC via proxy — overkill pro P2.

- 🔸**DECISÃO 4 — Global API key só no servidor.** `EVOLUTION_API_URL` + `EVOLUTION_API_KEY` (global) só
  em env server-side; o browser nunca fala com o Evolution. `ChannelService` (hoje client) vira um
  cliente fino que chama **novas rotas Next** `/api/whatsapp/instance/*`. O `token` por-instância
  (retornado no create) é persistido em `myia_channels.token` e usado no envio daquela instância.

- 🔸**DECISÃO 5 — Ingress de texto primeiro; mídia é fase 2.** `messages.upsert` com
  `data.message.conversation ?? data.message.extendedTextMessage?.text`. Mídia (base64/URL) precisa de
  storage (MinIO vs Supabase Storage — follow-up #2 do Plano 1, ainda aberto) → **fora do P2**; guardar
  o payload cru em `myia_messages.message` mesmo assim (não perde dado), só não baixa/renderiza o binário.

- 🔸**DECISÃO 6 — Ignorar grupos (`@g.us`) e `fromMe===true` no ingress.** Produto é atendimento 1:1.
  `SEND_MESSAGE`/echo próprio não cria "nova mensagem do cliente".

- 🔸**DECISÃO 7 — Idempotência por `(instance_id, message_id)`.** Índice único parcial em
  `myia_messages` + upsert `on conflict do nothing`. Evolution reenvia em timeout.

- 🔸**DECISÃO 8 (recomendação, decisão final do usuário) — VPS: Contabo São Paulo (8 GB, ~US$7/mês).**
  Alinha com o Supabase em `sa-east-1` (LGPD/residência de dados no Brasil, que já foi o critério do
  Plano 1). _Alternativa:_ Hetzner CX22 (4 GB, ~US$5) — mais barato/estável, mas sem região BR
  (transferência internacional art. 33 LGPD). **Flag pro usuário confirmar.**

## Modelo de dados (mudanças mínimas)

Nova migration `supabase/migrations/0011_whatsapp_ingress.sql`:
- `create index if not exists idx_channels_instancewpp on myia_channels("instanceWpp");`
- `create unique index if not exists uq_messages_instance_msgid on myia_messages(instance_id, message_id) where message_id is not null;`
- (opcional) `alter table myia_channels add column if not exists webhook_secret text;` — se quisermos
  segredo por-canal em vez de global. 🔸DECISÃO: **começar com segredo global** (env), coluna fica pra depois.
- Testes SQL `supabase/tests/0011_whatsapp_ingress.test.sql` (índices existem; upsert dedup funciona).

## Superfície de código

**Codável HOJE (sem VPS vivo):**
1. **Migration 0011** + teste (`db-test.mjs`).
2. **Ingress:** `src/app/api/whatsapp/ingress/route.ts` (service role): valida header secreto → resolve
   canal por `instance` → upsert `myia_contacts` (por `company_id`+`remote_jid`) → upsert `myia_chat`
   (set `last_message`, `instance_id`) → insert `myia_messages` idempotente. Responde 200 rápido. Testável
   por `curl` com o payload de exemplo do B2 (§3.3).
3. **Envio:** editar `src/app/api/messages/send/route.ts` — trocar o `fetch` do n8n por
   `POST {channel.urlapi}/message/sendText/{channel.instanceWpp}` com `apikey: channel.token`; **corrigir
   o lookup de canal** (join por `instanceWpp = myia_chat.instance_id`, não `channel_id`).
4. **Gestão de instância:** `src/app/api/whatsapp/instance/route.ts` (ou create/connect/logout/delete) —
   server, usa `EVOLUTION_API_URL`+`EVOLUTION_API_KEY`, chama Evolution, persiste `token/instanceWpp/
   qrcode64/pairing_code/status` em `myia_channels`. Reescrever `src/services/ChannelService.ts` pra
   chamar essas rotas. Religar `assistants/[assistant_id]/Channels/{model.ts,view.tsx}`.
5. **Env scaffolding:** `.env.local`/`.env.example` — `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`,
   `EVOLUTION_WEBHOOK_SECRET` (placeholders até o VPS existir).
6. **Doc de deploy VPS:** `docs/deploy/evolution-vps.md` (compose §1.2 + nginx §5.2 + `.env` §1.3 do B2).

**Precisa do VPS (tarefa do usuário / fase live):** subir Evolution (compose+nginx+TLS+ufw), criar
instância real, parear QR, teste ponta-a-ponta ao vivo, apontar webhook pro nosso domínio.

## Verificação

- **Migration:** `node scripts/db-test.mjs supabase/tests/0011_whatsapp_ingress.test.sql` (PASS = 0 linhas).
- **Ingress sem VPS:** `curl -XPOST localhost:3000/api/whatsapp/ingress -H "X-Auri-Webhook-Secret: <dev>"
  -d '<payload messages.upsert de exemplo>'` → confere linha em `myia_messages` com `company_id` certo
  (tenant resolvido) e Realtime chegando no painel. Testar dedup (mesmo `message_id` 2x → 1 linha),
  header errado → 401, `fromMe:true`/`@g.us` → drop.
- **Build:** `npm run build` limpo (ver issue #9 do build — resolver antes/junto).
- **Live (com VPS):** parear número de teste, mandar msg do celular → aparece na inbox; responder pela
  inbox → chega no celular.

## Dependências / riscos
- **Build de produção quebrado** (task #9) — precisa resolver pro deploy; provavelmente pré-existente
  (prerender estático da home). Fix provável: `export const dynamic = 'force-dynamic'` no layout privado.
- **Storage de mídia** não resolvido (follow-up #1 do Plano 1) — limita ingress a texto por ora.
- **Ban de número** (Baileys é não-oficial) — risco operacional, não de código.
- **Concorrência de checkout** na implementação: um único working tree compartilhado pelos agentes →
  serializar tarefas que mutam git ou usar worktrees.
