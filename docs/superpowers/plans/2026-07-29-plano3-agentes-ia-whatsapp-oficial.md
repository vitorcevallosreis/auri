# Plano 3 — Agentes IA no WhatsApp Oficial: implementação

Plano de execução. Spec: `docs/superpowers/specs/2026-07-29-plano3-agentes-ia-whatsapp-oficial.md`.
Branch sugerida: `feat/plan3-agentes-ia-cloud-api`.

Decisões fechadas: Cloud API **substitui** o Evolution · **Embedded Signup** ·
**nós escolhemos o modelo** (`claude-opus-5`) · **cobrança por conversa** (janela de 24h).

---

## P3.0 — Habilitação na Meta (externo, começar HOJE)

Não é código e **bloqueia P3.1 em diante**. Verificação de negócio + App Review levam semanas.

- [ ] Meta Business Account + **Business Verification** (documentos da empresa)
- [ ] App Meta com produto WhatsApp; App em **modo Live** (Embedded Signup não roda em dev)
- [ ] App Review: `whatsapp_business_messaging`, `whatsapp_business_management`, `business_management`
- [ ] Configurar **Embedded Signup** (fluxo de Tech Provider)
- [ ] Registrar webhook URL + verify token; guardar o **App Secret** (assinatura HMAC)
- [ ] Submeter os primeiros templates: confirmação de agendamento, lembrete 24h, reengajamento
- [ ] Levantar o **rate card vigente** da Meta (a precificação mudou de conversa para mensagem
      em 2025) — entra no modelo de margem de P3.8

**Saída:** `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, config do Embedded
Signup, IDs dos templates aprovados.

---

## P3.1 — Canal Cloud API (substitui o Evolution)

**Migration `0013_wa_cloud_channels`**
- `myia_channels.provider` text default `'cloud'` (`evolution` | `cloud`)
- Nova `myia_wa_cloud_numbers`: `company_id`, `waba_id`, `phone_number_id` (unique),
  `display_number`, `quality_rating`, `access_token_encrypted`, `verified_at`, `status`
- RLS multi-tenant padrão + **REVOKE SELECT do cliente** em `access_token_encrypted`
- Índice único em `phone_number_id` (é a chave de roteamento do webhook)

**Código**
- `src/lib/whatsapp/ChannelAdapter.ts` — interface de 3 métodos (costura de teste)
- `src/lib/whatsapp/CloudApiAdapter.ts` — Graph API: `send`, `sendTemplate`, `verifyWebhook`
- `src/app/api/whatsapp/cloud/webhook/route.ts`
  - `GET`: handshake `hub.mode`/`hub.verify_token`/`hub.challenge`
  - `POST`: verifica `X-Hub-Signature-256` (HMAC SHA-256 com App Secret, **comparação
    time-safe**) → resolve tenant por `phone_number_id` → dedup por `message.id` →
    grava em `myia_messages` → enfileira → **200 em <5s**
- `src/app/api/whatsapp/cloud/signup/route.ts` — troca do code do Embedded Signup por token,
  descoberta de `waba_id`/`phone_number_id`, subscribe do app ao WABA
- UI Channels: QR code → botão "Conectar WhatsApp" (popup Embedded Signup)

**Remoção do Evolution** (no fim desta fase, banco vazio ⇒ sem risco)
- `src/app/api/whatsapp/ingress/`, `src/app/api/whatsapp/instance/`
- Trecho Evolution de `src/app/api/messages/send/route.ts`
- Chamadas diretas ao Evolution em `src/services/MessageService.ts` (1457 linhas — fecha o
  tracker #14 por eliminação da superfície)
- Envs `EVOLUTION_API_*` saem do deploy

**Testes:** assinatura inválida → 401; replay do mesmo `message.id` → 1 linha; webhook de
`phone_number_id` desconhecido → 200 sem gravar.

---

## P3.2 — Fila + worker

- Fila: `pgmq` no Supabase (ou tabela + `SELECT ... FOR UPDATE SKIP LOCKED`)
- Novo container **`auri-agent-worker`** (Node 22, mesma rede docker, `restart: always`)
- **Debounce 2–4s coalescendo por `chat_id`** — sem isso, "oi" + "queria marcar" + "amanhã"
  viram 3 turnos do modelo (3× custo, respostas atropeladas)
- Concorrência limitada por tenant
- Adicionar o worker ao `scripts/deploy-app-vps.sh`

**Testes:** 3 mensagens em 1s → 1 turno; worker morto no meio → job reprocessado.

---

## P3.3 — Loop do agente (leitura) + observabilidade

**Migration `0014_agent_runs`**
- `myia_agent_runs`: `company_id`, `assistant_id`, `chat_id`, `conversation_id`, `model`,
  `effort`, `status`, `stop_reason`, `input_tokens`, `output_tokens`,
  `cache_read_tokens`, `cache_write_tokens`, `latency_ms`, `error`
- `myia_agent_tool_calls`: `run_id`, `tool_name`, `input`, `output`, `is_error`, `duration_ms`

**Código**
- `buildSystemPrompt(assistant, company)` — persona + serviços + profissionais + convênios +
  políticas + Trainings. **Determinístico**: sem `new Date()`, JSON com chaves ordenadas.
  `cache_control: {type:"ephemeral"}` no último bloco; TTL 1h para tenant de baixo volume
- Data/hora atual vai na mensagem do usuário ou em `{role:"system"}` no fim de `messages`
- `client.beta.messages.toolRunner()` com `claude-opus-5`,
  `thinking:{type:"adaptive"}`, `output_config:{effort:"medium"}`, `max_tokens` folgado
- Tools de **leitura**: `buscar_servicos`, `listar_profissionais`,
  `consultar_disponibilidade`, `identificar_paciente`, `consultar_convenios`
- **`company_id` nunca é parâmetro de tool** — o worker injeta a partir do canal

**Testes:** `cache_read_input_tokens > 0` no 2º turno; tool de tenant A não enxerga dado de B.

---

## P3.4 — Tools de escrita

**Migration `0015_appointments_no_overlap`** — constraint de exclusão (`btree_gist`) em
`myia_appointments` contra duplo agendamento. Garantia no banco, não na lógica.

- `agendar_consulta`, `remarcar_consulta`, `cancelar_consulta`, `cadastrar_paciente`
- Toda escrita **revalida disponibilidade dentro da transação** — o modelo pode alucinar
  horário. Slot sumiu ⇒ `tool_result` com `is_error: true` e o agente renegocia
- Confirmação explícita do paciente antes de gravar

**Testes:** dois agendamentos concorrentes no mesmo slot → 1 sucede, 1 falha limpo;
horário inventado pelo modelo → erro tratado, não exceção.

---

## P3.5 — Escalonamento humano

- Tool `transferir_para_humano` → `myia_chat.chat_pause = true`, `bot_running = false`
- Gatilhos duros (não só prompt): sintoma agudo/urgência, pedido de conduta médica,
  reclamação, negociação de preço, qualquer item de `avoided_topics`
- Worker **respeita `chat_pause`**: mensagem chega, é gravada, agente não responde
- Inbox mostra o estado e permite devolver ao agente

**Guardrail clínico:** o agente não diagnostica, não indica tratamento, não interpreta exame.

**Testes:** com `chat_pause=true` nenhum run é criado; frase de urgência escala em 1 turno.

**→ Fim da Fase 1. Aqui o produto atende e agenda de verdade.**

---

## P3.6 — Página Agentes IA

**Migration `0016_agent_tools_config`** — habilitação de tool por assistente + regras de
escalonamento. Dá persistência ao que a página precisa configurar.

- Aba de tools: ligar/desligar por assistente
- **Remover o seletor de LLM da UI** (DECISÃO 3) — vira ops-only
- Regras de escalonamento editáveis
- Preview/teste do agente sem gastar conversa real

---

## P3.7 — FollowUps com templates

**Migrations** `0017_wa_templates` (sync da Meta: name, language, status, components,
category) e `0018_followups` (`myia_assistant_followups` com **`template_id`**, delay,
auto_close; `myia_followup_jobs` com `scheduled_at`, `status`).

- Scheduler (pg_cron ou tick do worker)
- **Fora da janela de 24h só template aprovado** — a UI deve impedir texto livre ali,
  não descobrir isso no erro da Meta

---

## P3.8 — Cobrança por conversa

**Migration `0019_conversations`** — `myia_conversations`: `company_id`, `chat_id`,
`opened_at`, `closes_at`, `opened_by` (`inbound` | `template`), `message_count`,
`agent_run_count`, `internal_cost_cents`, `billable`.

- Janela de 24h por contato; abre na 1ª mensagem fora de janela aberta
- `myia_agent_runs.conversation_id` → COGS por conversa sai de graça do que P3.3 grava
- Distinguir business-initiated de user-initiated (a Meta cobra diferente)
- Painel: conversas no período, custo interno, margem
- `myia_settings_assistants.used_tokens` rebaixado a métrica interna

---

## Ordem de trabalho

```
P3.0 (externo, semanas) ──────────────────┐
                                          ▼
P3.1 canal ─→ P3.2 fila ─→ P3.3 leitura ─→ P3.4 escrita ─→ P3.5 handoff   ← Fase 1
                                   │
                                   ├─→ P3.6 UI Agentes IA
                                   ├─→ P3.7 FollowUps (precisa templates de P3.0)
                                   └─→ P3.8 cobrança
```

P3.6/3.7/3.8 são paralelizáveis depois de P3.4.

## Invariantes que não podem ser violados

1. `company_id` nunca vem do modelo — sempre do canal, injetado pelo worker
2. Toda escrita revalida no servidor, dentro da transação
3. Token do WABA é server-only e criptografado; cliente nunca faz SELECT nele
4. Webhook: HMAC verificado + idempotente por `message.id`
5. Sem thinking desligado em Opus 5 (tool call vira texto e a ferramenta não roda)
6. Nada volátil antes do breakpoint de cache
