# Plano 3 — Agentes IA no WhatsApp (API Oficial)

Spec de arquitetura. Data: 2026-07-29. Status: **decisões fechadas** (ver §8), pronta para virar plano.

Objetivo: agentes de IA configurados na página **Agentes IA** (`/assistants`) que atendem
pacientes de clínicas no WhatsApp pela **API oficial (Meta WhatsApp Cloud API)**, com
capacidade real de agendar — não só conversar.

---

## 0. O que já existe (reaproveitamento)

Levantado no código em 2026-07-29:

| Peça | Estado | Uso no Plano 3 |
|---|---|---|
| `myia_assistants` | ✅ completa | Persona do agente: `purpose`, `objective`, `identity`, `greetings`, `strategy`, `behavior`, `fallbacks`, `avoided_topics`, `step_by_step`, `goodbye`, `roles`, `tel_fallback`, `llm`, `paused` |
| `myia_assistants_llms` | ✅ | Catálogo de modelos por assistente |
| `myia_settings_assistants` | ✅ | `used_tokens` / `available_tokens` — base do billing |
| `myia_chat` / `myia_messages` | ✅ | Histórico da conversa = estado do agente. `myia_chat.bot_running` e `chat_pause` **já são a primitiva de handoff humano** |
| Domínio de agendamento | ✅ | `myia_services`, `myia_professionals_medical`, `myia_professional_availability`, `myia_appointments`, `myia_contacts`, `myia_specialties`, `myia_company_agreements`, `myia_company_policies` — **é exatamente a superfície de tools do agente** |
| Ingress + inbox realtime | ✅ (Evolution) | Padrão a replicar para Cloud API |
| `myia_channels` | ⚠️ formato Evolution | `instanceWpp`/`token`/`urlapi`/`qrcode64` não servem para Cloud API |
| Abas SubAgents / Trainings / FollowUps / Integrations | ❌ UI sem persistência | Nenhuma tabela por trás. São cascas |
| Runs / traces / custo por conversa | ❌ inexistente | Precisa ser criado |

**Conclusão:** o domínio de agendamento está pronto e é o ativo mais valioso aqui. O que falta
é (a) o canal oficial, (b) o loop do agente, (c) observabilidade, (d) persistência das 4 abas.

---

## 1. Decisão de stack — o loop do agente

### ✅DECISÃO A (técnica, fechada): Claude API + Tool Runner, **não** Claude Agent SDK

O roadmap anterior (memória do Plano 1) registrou "Plano 3 = Agent Service (Claude Agent SDK)".
**Isso está errado para este caso de uso** e precisa ser corrigido antes de qualquer código.

| Opção | O que é | Veredito |
|---|---|---|
| **Claude API + Tool Runner** (`client.beta.messages.toolRunner`) | SDK roda o loop pedido→tool→resposta; nós definimos as tools e hospedamos | ✅ **Escolhido** |
| Managed Agents | Anthropic roda o loop **e** hospeda um container por sessão (bash, arquivos, code exec) | ❌ Não precisamos de sandbox. Um container por conversa de WhatsApp é a forma e o custo errados |
| Claude Agent SDK | Claude Code empacotado como biblioteca — ferramentas de arquivo/bash embutidas | ❌ É um agente de codebase. Nada a ver com responder paciente |

O agente aqui é **stateless por turno**: chega mensagem → reidrata histórico do Postgres →
chama o modelo com tools → grava resposta. Não há workspace, não há arquivos, não há
sessão longa a hospedar. Tool Runner é exatamente essa forma.

### Modelo

- **`claude-opus-5`**, escolhido por nós e não exposto ao cliente (DECISÃO 3). O seletor de
  LLM sai da UI de Agentes IA; `myia_assistants.llm` e `myia_assistants_llms` passam a ser
  registro interno de ops, usados para rollout controlado — não configuração do cliente.
- **`thinking: {type: "adaptive"}`** — manter ligado. Em Opus 5 desligar o thinking tem dois
  modos de falha documentados, e um deles é **a tool call sair como texto simples**: o turno
  "sucede", a ferramenta nunca roda, nenhum erro é levantado. Num agente que agenda consulta
  isso é inaceitável.
- **Latência** se controla por `output_config.effort`, não desligando thinking. Começar em
  `medium` e varrer `low`/`medium`/`high` contra evals reais. Em Opus 5 os níveis baixos são
  fortes — é a alavanca certa para chat.
- `max_tokens` com folga: thinking + resposta dividem o mesmo teto.

### Prompt caching — é aqui que o custo é decidido

Ordem de render: `tools` → `system` → `messages`. O system prompt de cada clínica
(persona + serviços + profissionais + convênios + políticas) é grande e **estável**:
`cache_control: {type: "ephemeral"}` no último bloco de system. Leitura de cache custa ~0,1×.

- TTL 5min serve clínica movimentada; **TTL 1h** para clínica de baixo volume.
- Invariante: nada volátil antes do breakpoint. **Sem `new Date()` no system prompt** — data/hora
  entra na mensagem do usuário ou como `{role:"system"}` no fim de `messages`.
- Mínimo cacheável em Opus 5 = 512 tokens (menor que os 1024 de modelos anteriores).

---

## 2. Canal — WhatsApp Cloud API

### ✅DECISÃO 2 (fechada): Cloud API **substitui** o Evolution

O Plano 2 entregou um gateway Evolution **em produção** (`wa.auri.global`). A API oficial
não é um upgrade drop-in — é outro modelo de integração:

| | Evolution (atual) | Cloud API (oficial) |
|---|---|---|
| Vínculo do número | QR code / pairing | **Embedded Signup** (OAuth) — cada clínica conecta o próprio WABA sob a nossa conta de Tech Provider |
| Identificador | `instanceWpp` | `phone_number_id` + `waba_id` |
| Mensagem proativa | Livre | **Só template aprovado pela Meta** fora da janela de 24h |
| Webhook | Por instância | Por App — roteamento por `phone_number_id` |
| Risco | Viola ToS do WhatsApp, número pode ser banido | Suportado oficialmente |
| Custo | Infra própria | Por mensagem (checar tabela vigente da Meta) |

**Custo da substituição: praticamente zero.** Contagem no Supabase em 2026-07-29:
`myia_channels`, `myia_chat`, `myia_messages`, `myia_contacts` e `myia_appointments` têm
**0 linhas** (só 2 linhas de seed em `myia_assistants`). O gateway Evolution foi construído
e passou no smoke test, mas nunca carregou uma conversa real — não há dado a migrar, nem
cutover, nem conversa em andamento.

Isso invalida a justificativa original do `ChannelAdapter`, que eu tinha proposto para
proteger o investimento do Plano 2: não há investimento em produção a proteger. Fica uma
**interface fina só como costura de teste** (permite um `FakeAdapter` nos testes sem
bater na Meta), com uma única implementação real:

```
ChannelAdapter (interface — 3 métodos, existe para testabilidade)
  └── CloudApiAdapter
      send(to, content) / sendTemplate(to, template, vars) / verifyWebhook(req)
```

O código do Evolution é **removido** ao final da Fase 3.1, não mantido em paralelo:
`src/app/api/whatsapp/ingress`, `src/app/api/whatsapp/instance`, o trecho Evolution de
`src/app/api/messages/send`, e as chamadas diretas ao Evolution em
`src/services/MessageService.ts`. Isso resolve de lambuja o tracker #14 (segredos de
instância legíveis pelo cliente) — a superfície que o causava deixa de existir.

Containers do Evolution no VPS podem ser desligados depois da Fase 3.5 validada.

### A janela de 24 horas muda o produto

Fora de 24h desde a última mensagem do paciente, **só dá para enviar template aprovado**.
Isso atinge diretamente a aba **FollowUps**: lembrete de consulta, reengajamento e
confirmação viram templates registrados na Meta, não texto livre. A modelagem de follow-up
tem que nascer com `template_id`, não com `message_text`.

### Pré-requisitos externos (bloqueiam o desenvolvimento — começar já)

1. Meta Business Account + verificação de negócio
2. App Meta com produto WhatsApp
3. App Review: `whatsapp_business_messaging`, `whatsapp_business_management`, `business_management`
4. Embedded Signup configurado (multi-tenant)
5. Templates iniciais submetidos (aprovação leva dias)

⚠️ **Verificação de negócio + App Review levam semanas.** Iniciar em paralelo à Fase 1.

---

## 3. Arquitetura de execução

```
Meta Cloud API
   │  webhook POST (assinado HMAC SHA-256)
   ▼
/api/whatsapp/cloud/webhook  (Next.js)
   │  1. verifica X-Hub-Signature-256
   │  2. resolve tenant por phone_number_id
   │  3. dedup por message id (retry da Meta)
   │  4. grava em myia_messages, enfileira job
   │  5. responde 200 em <5s   ◄── obrigatório, senão a Meta reentrega
   ▼
fila (pgmq no Supabase, ou tabela + SELECT ... FOR UPDATE SKIP LOCKED)
   ▼
agent-worker  (container Node 22 no mesmo VPS/rede docker)
   │  debounce 2–4s e coalesce  ◄── paciente manda "oi" / "queria marcar" / "amanhã"
   │  monta system prompt (cacheado) + histórico
   │  client.beta.messages.toolRunner({ tools: schedulingToolset })
   │  grava run + tool calls + tokens
   ▼
ChannelAdapter.send() → Cloud API → paciente
   │
   └─ grava myia_messages (from_me=true) → Realtime → inbox do painel
```

### Por que um worker separado do Next.js

- A Meta exige ack rápido; um turno de agente leva segundos.
- Controle de concorrência por tenant (evitar que uma clínica movimentada consuma tudo).
- Deploy do painel não derruba conversa em andamento.
- Já temos VPS com Docker e rede `evolution_evolution-net` — é só mais um container.

### Debounce

Sem ele, três mensagens seguidas viram três turnos do modelo (3× custo, respostas
atropeladas e fora de ordem). Janela de 2–4s coalescendo por `chat_id`.

---

## 4. Superfície de tools

Mapeiam 1:1 nas tabelas existentes:

| Tool | Tabelas | Tipo |
|---|---|---|
| `buscar_servicos` | `myia_services` | leitura |
| `listar_profissionais` | `myia_professionals_medical`, `myia_specialties` | leitura |
| `consultar_disponibilidade` | `myia_professional_availability`, `myia_appointments` | leitura |
| `identificar_paciente` / `cadastrar_paciente` | `myia_contacts` | leitura / escrita |
| `consultar_convenios` | `myia_company_agreements` | leitura |
| `agendar_consulta` | `myia_appointments` | **escrita** |
| `remarcar_consulta` / `cancelar_consulta` | `myia_appointments` | **escrita** |
| `transferir_para_humano` | `myia_chat.chat_pause` / `bot_running` | escrita |

### Invariantes de segurança — não negociáveis

1. **O modelo nunca fornece `company_id`.** Não existe como parâmetro de tool. O worker
   resolve o tenant pelo `phone_number_id` do canal e injeta em toda query. Um `company_id`
   vindo do modelo é vazamento cross-tenant esperando acontecer.
2. **Escrita revalida no servidor.** O modelo pode alucinar um horário. `agendar_consulta`
   reconfere disponibilidade dentro da transação e falha explicitamente se o slot sumiu.
3. **Constraint de exclusão** em `myia_appointments` contra duplo agendamento —
   garantia no banco, não na lógica.
4. **Tokens do WABA são server-only e criptografados.** Mesmo erro do tracker #14
   (`myia_channels.token` legível pelo cliente via RLS) não pode se repetir.
5. **Verificação HMAC do webhook** + idempotência por message id.

### Guardrails clínicos

Domínio de saúde no Brasil. O agente **não** diagnostica, não indica tratamento, não
interpreta exame. `avoided_topics` já existe no schema e deve alimentar uma regra dura de
escalonamento, não só uma frase no prompt. Escalonar para humano em: sintoma agudo/urgência,
pedido de conduta médica, reclamação, negociação de preço, qualquer item de `avoided_topics`.

---

## 5. Mudanças de schema (migrations 0013+)

| Migration | Conteúdo |
|---|---|
| `0013_wa_cloud_channels` | `myia_channels.provider` (`evolution` \| `cloud`) + nova `myia_wa_cloud_numbers` (`waba_id`, `phone_number_id`, `display_number`, `quality_rating`, `access_token_encrypted`, `verified_at`). Revogar SELECT do cliente nas colunas de segredo |
| `0014_agent_runs` | `myia_agent_runs` (company_id, assistant_id, chat_id, model, effort, status, stop_reason, input/output/cache tokens, latency_ms, error) + `myia_agent_tool_calls` (run_id, tool_name, input, output, is_error, duration_ms) |
| `0015_followups` | `myia_assistant_followups` (step, delay, `template_id`, auto_close) + `myia_followup_jobs` (scheduled_at, status) — dá persistência à aba FollowUps |
| `0016_wa_templates` | `myia_wa_templates` sincronizada da Meta (name, language, status, components, category) |
| `0017_agent_tools_config` | Habilitação de tool por assistente + regras de escalonamento — dá persistência ao que a página Agentes IA precisa configurar |

### ✅DECISÃO B (técnica, fechada): RAG (aba Trainings) — adiar

Instinto natural é pgvector. **Recomendo não fazer na Fase 1.** O corpus de uma clínica
(FAQ, preços, políticas, preparo de exame) é pequeno e cabe no system prompt — que já está
cacheado a ~0,1× do custo. RAG adiciona: provedor de embeddings (a Anthropic não tem API de
embeddings — precisaria Voyage ou similar), pipeline de indexação, tuning de retrieval e uma
nova classe de bug ("por que o agente não achou isso?").

Fazer RAG só quando um tenant real estourar o orçamento de contexto. Até lá, `Trainings` =
texto que entra no bloco cacheado.

### Sub-agentes — adiar

Uma chamada de modelo com boas tools resolve o fluxo de agendamento. Sub-agentes multiplicam
custo e latência sem ganho aqui. A aba fica, a implementação espera evidência de necessidade.

---

## 6. Fases

| Fase | Entrega | Depende de |
|---|---|---|
| **3.0** | Iniciar verificação Meta + App Review + templates | — (externo, semanas) |
| **3.1** | `ChannelAdapter` + `CloudApiAdapter` + webhook assinado + dedup + resolução de tenant | 3.0 parcial |
| **3.2** | Fila + `agent-worker` container + debounce | 3.1 |
| **3.3** | Toolset de agendamento (leitura) + system prompt cacheado + `myia_agent_runs` | 3.2 |
| **3.4** | Tools de escrita (agendar/remarcar/cancelar) + constraint de exclusão + revalidação transacional | 3.3 |
| **3.5** | Escalonamento humano ligado a `chat_pause` + inbox | 3.4 |
| **3.6** | Página Agentes IA: config de tools, modelo, effort, regras de escalonamento (0017) | 3.4 |
| **3.7** | FollowUps com templates (0015 + 0016) | 3.0 aprovado |
| **3.8** | Painel de custo por conversa a partir de `myia_agent_runs` | 3.3 |

Fase 1 real = **3.1 → 3.5**. É o menor recorte que atende paciente e agenda de verdade.

---

## 7. Riscos

| Risco | Mitigação |
|---|---|
| App Review da Meta demora ou é negado | Iniciar em 3.0, antes de qualquer código. Evolution segue como fallback |
| Duplo agendamento por concorrência | Constraint de exclusão no banco + revalidação transacional |
| Vazamento cross-tenant via tool | `company_id` nunca é parâmetro do modelo |
| Custo por conversa fora de controle | `myia_agent_runs` desde a Fase 3.3; prompt caching; varredura de `effort` |
| Agente dá conselho médico | Guardrail duro + escalonamento; `avoided_topics` como regra, não sugestão |
| Alucinação de horário | Toda escrita revalida no servidor |
| Investimento do Plano 2 virar dívida | `ChannelAdapter` desde o primeiro commit |

---

## 8. Decisões fechadas (2026-07-29)

| # | Decisão | Consequência |
|---|---|---|
| 1 | **Cloud API substitui o Evolution** | Código do Evolution é removido na Fase 3.1, não mantido. Banco vazio ⇒ sem migração. `ChannelAdapter` fica só como costura de teste |
| 2 | **Embedded Signup** — cada clínica conecta o próprio número | Exige conta de Tech Provider, App em modo Live e Business Verification. A aba Channels perde o QR code e ganha um botão OAuth. Token por tenant, criptografado |
| 3 | **Nós escolhemos o modelo** | `claude-opus-5` fixo. O seletor de LLM sai da UI do cliente; `myia_assistants.llm` e `myia_assistants_llms` viram registro interno de ops. `effort` é tunado por nós |
| 4 | **Cobrança por conversa** | Ver §9 — precisa de uma definição operacional de "conversa" |

## 9. Unidade de cobrança — definição de "conversa"

Cobrar por conversa exige um recorte sem ambiguidade. Adotado:

> **Uma conversa = uma janela de 24h por contato, aberta pela primeira mensagem
> recebida fora de uma janela já aberta.**

Por que 24h e não "thread resolvida": é o mesmo recorte que a própria Meta usa para a
janela de atendimento, então nossa unidade de receita tem a mesma forma da nossa unidade
de custo — a margem fica trivial de calcular. Fim ambíguo ("quando a conversa acabou?")
deixa de existir.

Uma conversa aberta por **template nosso** (follow-up, lembrete) também é billable, e a
Meta cobra business-initiated diferente de user-initiated — a tabela de preço precisa
distinguir as duas.

Nova tabela `myia_conversations`: `company_id`, `chat_id`, `opened_at`, `closes_at`,
`opened_by` (`inbound` | `template`), `message_count`, `agent_run_count`,
`internal_cost_cents`, `billable`. `myia_agent_runs.conversation_id` referencia ela — o
custo interno (tokens) vira COGS por conversa e sai de graça do que a Fase 3.3 já grava.

`myia_settings_assistants.used_tokens` continua existindo, mas rebaixado a métrica interna
de custo — não é mais a base de cobrança.

⚠️ **A verificar antes de precificar:** a tabela de preços da Meta mudou de conversa para
mensagem em 2025. Nossa *receita* pode continuar por conversa independentemente disso, mas
o modelo de margem depende do rate card vigente — checar na documentação da Meta, não na
minha memória.
