# Fundação — Relançamento do myia_app (Design)

**Data:** 2026-07-15
**Status:** Aprovado (design) → próximo passo: plano de implementação
**Autor:** Vitor + Claude

---

## 1. Objetivo

Voltar o **myia_app** ao ar em uma infraestrutura que nós controlamos, com o assistente de
WhatsApp funcionando, para validar em clínicas reais. O "cérebro" do assistente (antes em fluxos
n8n do dev antigo) **se perdeu** e será reconstruído do zero como serviço de agente em código,
usando o **Claude Agent SDK** (Opção B).

Este documento cobre **apenas a Fundação** (MVP para ir ao ar). Fases posteriores
(gestão financeira + split payment + conciliação fiscal, prontuário por IA, plataforma de dados
RWE anonimizada) têm specs próprias e estão fora deste escopo — ver §9.

## 2. Escopo

**Dentro:**
1. Novo projeto **Supabase que controlamos** + migração de schema e dados.
2. **Evolution API self-hosted** (gateway WhatsApp próprio — o antigo se perdeu).
3. **Agent Service** novo (Node + Claude Agent SDK): ingress, agente com tools de agendamento/FAQ,
   egress, follow-ups.
4. Religar o painel **Next.js** no novo backend (env vars) e fazer deploy.

**Fora (fases futuras):** backend financeiro, prontuário por IA, plataforma RWE, redesign UI/UX amplo.

## 3. Decisões tomadas (brainstorming)

| Decisão | Escolha | Motivo |
|---|---|---|
| Stack de backend | Novo Supabase que controlamos | Caminho mais rápido pro ar; mantém ~90% do código (auth, storage, realtime, RLS) |
| Runtime do agente | Reescrever em código (Claude Agent SDK) | n8n perdido; versionável e testável |
| Gateway WhatsApp | Evolution API self-hosted | O antigo se perdeu com o dev anterior |
| Fila (follow-up/debounce) | Simples — tabela Postgres + cron | Zero infra nova; suficiente pra validar |
| Transcrição de áudio | OpenAI Whisper (API) | Mais barato/simples pra áudio |

## 4. Arquitetura de infra

```
1 VPS (Docker Compose)  ~$12–25/mês
  Evolution API (WhatsApp)  ──webhook──▶  Agent Service (Node + Agent SDK)
        │                    ◀─send msg──          │
        │ QR/conexão                                │ SQL + tools
        ▼                                           ▼
   WhatsApp                              Supabase (nosso) — Postgres+Auth+Storage+Realtime
                                                     ▲
                                          Next.js (painel) — Vercel free ou mesmo VPS
```

**Componentes (responsabilidade única):**
- **Evolution API** — conecta no WhatsApp e repassa mensagens. Não decide nada.
- **Agent Service** — o cérebro. Detalhado em §6.
- **Supabase (nosso)** — dados, auth, storage, realtime. Painel fala direto com ele.
- **Next.js** — painel de gestão existente.

**Custo estimado:** ~$25–50/mês de infra fixa + uso da API do Claude (variável por conversa) +
uso do Whisper (variável, só quando há áudio).

## 5. Migração de backend (Supabase → Supabase nosso)

1. Criar projeto Supabase novo na nossa conta/organização.
2. Exportar schema atual (tabelas `myia_*` — ver `src/contexts/supa_tables.ts` e
   `src/database/scheduling_tables.sql`) e aplicar no novo projeto, incluindo RLS.
3. Migrar dados existentes (se houver base de validação a preservar; caso contrário, começar limpo).
4. Migrar Storage (buckets MinIO/S3 → Storage do novo Supabase, ou manter MinIO e só reapontar).
5. Trocar env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_STORAGE_URL` (ver `.env` / `.env.local`).
6. Smoke test do painel contra o novo backend.

## 6. Agent Service (detalhe)

Node worker com quatro camadas de responsabilidade única.

### 6.1 Ingress + Debounce
- Recebe webhook da Evolution API.
- **Debounce ~5–8s** por contato: agrupa mensagens picadas antes de acionar o agente.
- Áudio → transcrição via **Whisper (API)** antes de entrar no contexto.
- Emite indicador de "digitando..." enquanto processa.

### 6.2 Context Builder
- Monta o estado da conversa a partir de:
  - Config do assistente da empresa: `purpose`, `objective`, `identity`, `greetings`, `strategy`,
    `behavior`, `behavior_text`, `step_by_step`, `avoided_topics`, `fallbacks`, `goodbye`, `roles`,
    `tel_fallback` (tabela `myia_assistants`).
  - Histórico recente de `myia_messages`.
  - Dados do contato (`myia_contacts`).
- Esses campos viram o **system prompt estruturado** do agente. Multi-tenant sai de graça: cada
  empresa deriva seu prompt da sua própria config. **Nenhuma regra de negócio hardcoded no código** —
  personalidade/estratégia editáveis pelo painel, sem deploy.

### 6.3 Agent Loop (Claude Agent SDK)
Loop de tool-use. Cada tool faz UMA coisa e é testável isolada:

| Tool | Função | Tabelas |
|---|---|---|
| `consultar_disponibilidade` | slots livres por profissional/serviço/data | `myia_professional_availability`, `myia_appointments` |
| `agendar` | cria agendamento | `myia_appointments`, `myia_contacts` |
| `remarcar` / `cancelar` | altera status do agendamento | `myia_appointments` |
| `consultar_catalogo` | serviços, preços, duração | `myia_services`, `myia_products` |
| `info_clinica` | endereço, convênios, políticas, pagamento | `myia_company_*` |
| `handoff_humano` | pausa o bot (`assistant.paused`), avisa atendente | `myia_assistants`, `myia_channels` |
| `salvar_contato` | cria/atualiza lead | `myia_contacts` |

**Regra de ouro:** as tools são a única fonte de verdade sobre agenda/catálogo. O modelo nunca
inventa horário — sempre consulta via tool.

### 6.4 Egress + Follow-ups
- Envia resposta pela Evolution API; persiste em `myia_messages`.
- Agenda os **follow-up steps** existentes (`step_number`, `delay_minutes`, `message`, `auto_close`)
  na fila simples (§7).

### 6.5 Guard rails / tratamento de erro
- Assunto em `avoided_topics`, pedido de humano, ou falha do agente → `handoff_humano` +
  `tel_fallback`.
- Timeout/erro de tool → resposta de fallback + handoff, nunca resposta inventada.
- Toda tool valida ownership por `company_id` (multi-tenant isolado).

## 7. Fila (simples)
- Tabela Postgres (ex.: `myia_jobs`) com `run_at`, `type` (`followup` | `debounce_flush`), `payload`,
  `status`.
- Um cron (ou worker com `setInterval`) varre jobs vencidos e executa.
- Sem Redis/BullMQ nesta fase.

## 8. Testes
- **Tools:** teste unitário de cada tool contra um Supabase de teste (agendar em slot ocupado deve
  falhar; cancelar deve mudar status; disponibilidade deve respeitar `max_simultaneous_clients`).
- **Context Builder:** dado uma config de assistente, gera o system prompt esperado.
- **Agent Loop:** testes de conversa (fixtures de mensagens WhatsApp → tool calls esperadas), estilo
  o `MessageService.test.ts` já existente.
- **Ingress:** debounce agrupa mensagens picadas; áudio é transcrito antes do agente.

## 9. Fora de escopo (fases futuras, specs próprias)
1. **Backend financeiro** — gestão + split payment (custo do procedimento/serviço vs. restante) +
   conciliação fiscal.
2. **Prontuário por IA** — escuta ativa/transcrição da consulta com **consentimento explícito do
   paciente**; médico revisa e assina; áudio é dado sensível.
3. **Plataforma de dados RWE** — coleta de metadados de pacientes **anonimizada/agregada, com base
   legal e consentimento** (des-identificação, k-anonimato). **Não** vender dado identificável de
   paciente (LGPD art. 11 — dado sensível). Schema já nasce preparado para des-identificação.
4. **Redesign UI/UX** minimalista — contínuo, acompanha cada módulo.

## 10. Riscos / abertos
- **Migração de dados:** decidir se há base de validação a preservar ou se começamos limpo.
- **Storage:** manter MinIO ou mover pro Storage do Supabase novo.
- **Deploy do Next.js:** Vercel (free) vs. mesmo VPS — decidir no plano.
- **Custo variável do Claude/Whisper:** monitorar por conversa; `used_tokens`/`available_tokens` já
  existem em `myia_settings_assistants` para telemetria.
- **Conexão WhatsApp:** número/chip para a Evolution; risco de ban se disparo em massa (não é o caso
  no MVP conversacional).
