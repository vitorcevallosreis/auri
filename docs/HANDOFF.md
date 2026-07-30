# Handoff — Auri (myia_app)

> **Leia este arquivo primeiro.** Ele existe para você continuar sem re-derivar contexto.
> Atualizado: **2026-07-30**. Branch de trabalho: `feat/plan2-evolution-ingress`, último
> commit `9429b3b` (pushed).

---

## 1. O que "100% no ar" significa aqui

Cuidado com a ambiguidade, porque ela muda todo o planejamento:

- **O painel JÁ está no ar.** `https://app.auri.global` responde HTTP 200, container de pé.
  Dá para logar e navegar.
- **A plataforma NÃO atende ninguém.** Nenhum número de WhatsApp conectado, nenhum paciente,
  nenhuma conversa, nenhum agendamento. O banco tem **zero linhas** de negócio.

Então "100% no ar" = **um paciente manda mensagem no WhatsApp da clínica, o agente responde e
agenda**. É isso que falta, e é o que o Plano 3 constrói.

---

## 2. Estado verificado (2026-07-30)

### Infra
| Item | Estado |
|---|---|
| VPS | Contabo `80.190.72.243`, SSH **por chave** (`ssh root@80.190.72.243`, sem senha) |
| App | `https://app.auri.global` → HTTP 200, container `auri-app` |
| Evolution API | v2.3.7 em `https://wa.auri.global`, 3 containers `restart: always`, no ar há 13 dias |
| Rede docker | `evolution_evolution-net` |
| Supabase | projeto `ffkicwhchrwvavkhfqol` (sa-east-1), Postgres 17 |
| Migrations | **0001–0015 aplicadas** |
| Segredos | `<repo>/../.night-work/{vps-secrets.env,app-deploy.env}` |

### Banco — vazio de dados de negócio
Contado em 2026-07-29: **0 linhas** em `myia_channels`, `myia_chat`, `myia_messages`,
`myia_contacts`, `myia_appointments`. Apenas 2 assistentes de seed.

Isso é uma **boa notícia**: não há migração de dados, cutover nem conversa em andamento a
proteger em nenhuma mudança daqui pra frente.

### ⚠️ Conexão direta do Supabase está morta nesta rede
`db.<ref>.supabase.co` só publica registro AAAA (IPv6-only) e ficou inalcançável. O
`scripts/db-test.mjs` já **cai para o pooler automaticamente**
(`aws-1-sa-east-1.pooler.supabase.com:5432`, usuário `postgres.<ref>`). Se outro script falhar
com `EHOSTUNREACH`, é isso — copie o fallback de lá.

---

## 3. Histórico dos planos

### Plano 1 — migração para Supabase próprio ✅ COMPLETO, merjado na `main`
Schema `myia_*` reconstruído (migrations 0001–0010), RLS multi-tenant provada, Auth ligado ao
Supabase real. Commit de merge `15ff53e`.

### Plano 2 — Evolution API self-host ✅ CÓDIGO PRONTO / ⚠️ SUPERSEDIDO
Gateway Evolution no ar e com smoke-test verde, mas **nunca carregou uma conversa real**. O
Plano 3 decidiu substituí-lo pela API oficial da Meta — ver abaixo.

### Plano 3 — Agentes IA no WhatsApp oficial 🔄 EM ANDAMENTO
Spec e plano: `docs/superpowers/{specs,plans}/2026-07-29-plano3-agentes-ia-whatsapp-oficial.md`.

**Decisões fechadas com o maestro (2026-07-29):**
1. **Cloud API SUBSTITUI o Evolution** (código do Evolution sai; banco vazio ⇒ sem migração)
2. **Embedded Signup** — cada clínica conecta o próprio número
3. **Nós escolhemos o modelo** — `claude-opus-5`; seletor de LLM sai da UI do cliente
4. **Cobrança por conversa** = janela de 24h por contato (mesmo recorte da Meta)

**Correção de rota importante:** o roadmap do Plano 1 dizia "Plano 3 = Claude Agent SDK".
**Está errado.** O Agent SDK é o Claude Code como biblioteca (ferramentas de arquivo/bash), para
agente de codebase. Managed Agents também não serve (hospeda container por sessão — forma e custo
errados para conversa de WhatsApp). O agente aqui é **stateless por turno**, então a stack é
**Claude API + Tool Runner**.

| Fase | Estado | Entrega |
|---|---|---|
| P3.0 Habilitação na Meta | ❌ **NÃO INICIADA — BLOQUEIA TUDO** | Business Verification, App Review, Embedded Signup, templates |
| P3.1 Canal Cloud API | ✅ código pronto, **não testado contra a Meta** | migration 0013, adapter, webhook assinado, Embedded Signup, cripto do token |
| P3.2 Fila + worker | ✅ pronto e testado | migration 0014, `worker/`, debounce, `Dockerfile.worker` |
| P3.3 Turno do agente | ✅ código pronto, **modelo nunca chamado** | migration 0015, prompt, 5 tools de leitura, observabilidade |
| P3.4 Tools de escrita | ⬜ | agendar/remarcar/cancelar + constraint anti-overbooking |
| P3.5 Escalonamento humano | ⬜ | `transferir_para_humano` + envio real pelo WhatsApp |
| P3.6 UI Agentes IA | ⬜ | config de tools, remover seletor de LLM |
| P3.7 FollowUps | ⬜ | templates da Meta + scheduler |
| P3.8 Cobrança por conversa | ⬜ | `myia_conversations`, painel de custo |

---

## 4. 🔴 A decisão que trava o cronograma — DECIDIR ANTES DE CODAR

**P3.0 (verificação de negócio + App Review da Meta) leva SEMANAS** e bloqueia P3.1 em diante.
Enquanto isso, a plataforma não atende ninguém.

Existe um caminho alternativo, e ele é uma escolha do maestro, não minha:

| | **Caminho A — ponte pelo Evolution** | **Caminho B — só Cloud API** |
|---|---|---|
| Prazo até atender paciente | **dias** | **semanas** (espera a Meta) |
| Como | Evolution já está no ar e testado. Escrever um `EvolutionAdapter` na interface que já existe e ligar o ingress atual (`/api/whatsapp/ingress`) no `enqueueAgentTurn` | Esperar P3.0 e seguir o plano |
| Risco | **Viola os ToS do WhatsApp**; o número da clínica pode ser banido | Nenhum — é o caminho sancionado |
| Trabalho jogado fora | Pouco: o `ChannelAdapter` já isola o agente do transporte | — |

**Contexto que ajuda a decidir:** o `ChannelAdapter` (`src/lib/whatsapp/ChannelAdapter.ts`) foi
mantido como "costura de teste" quando a substituição foi decidida. Se o Caminho A for escolhido,
ele vira exatamente o que se precisa — o agente não sabe qual transporte está por baixo.

**Recomendação honesta:** iniciar **P3.0 hoje** de qualquer forma (não custa nada e o relógio já
está correndo), e decidir A ou B em função de quão urgente é ter clínica atendendo. Se houver
cliente esperando, A com número descartável de teste; se não, B.

---

## 5. Bloqueios concretos

| # | Bloqueio | Impacto | Como resolver |
|---|---|---|---|
| 1 | **P3.0 não iniciado** | Trava P3.1+ | Meta Business Account → Business Verification → App em modo Live → App Review (`whatsapp_business_messaging`, `whatsapp_business_management`, `business_management`) → Embedded Signup → submeter templates |
| 2 | **Sem `ANTHROPIC_API_KEY`** | O turno do agente (P3.3) nunca executou | Gerar chave e pôr em `.env.local` + `app-deploy.env` |
| 3 | **Envs do P3.1/P3.3 não estão no deploy** | Rotas novas responderiam 500 | Gerar e adicionar em `../.night-work/app-deploy.env` (ver §6) |
| 4 | Storage MinIO não migrado | Upload de imagem falha no painel | 5 rotas em `src/app/api/upload/*` usam MinIO; `.env.local` ainda tem placeholder |

---

## 6. Próximos passos — ordem para chegar a 100%

### Passo 0 — HOJE, não é código
```
[ ] Meta Business Account + Business Verification
[ ] App Meta com produto WhatsApp, em modo Live
[ ] App Review dos 3 escopos
[ ] Embedded Signup configurado
[ ] Submeter templates: confirmação de agendamento, lembrete 24h, reengajamento
[ ] Levantar o rate card VIGENTE da Meta (a precificação mudou de conversa para
    mensagem em 2025 — não confiar em memória para modelar margem)
```

### Passo 1 — gerar segredos e completar o deploy env
```bash
openssl rand -base64 32   # WHATSAPP_TOKEN_ENC_KEY
openssl rand -hex 32      # META_WEBHOOK_VERIFY_TOKEN
```
Adicionar em `../.night-work/app-deploy.env`: `META_APP_ID`, `META_APP_SECRET`,
`NEXT_PUBLIC_META_APP_ID`, `META_WEBHOOK_VERIFY_TOKEN`, `META_GRAPH_VERSION`,
`WHATSAPP_TOKEN_ENC_KEY`, `ANTHROPIC_API_KEY`, `AGENT_*`, `WORKER_*`.
Referência comentada completa: `.env.example`.

> ⚠️ **Guardar `WHATSAPP_TOKEN_ENC_KEY` em local seguro.** Perdê-la inutiliza todos os tokens
> de WhatsApp salvos e cada clínica precisa reconectar o número.

### Passo 2 — validar o agente contra o modelo de verdade
Com `ANTHROPIC_API_KEY`, é o primeiro teste que ninguém fez ainda:
```bash
npm run test:unit           # 31 testes, sem rede
npm run test:integration    # worker + isolamento das tools, contra o banco
# e então: criar uma clínica de teste com serviços/profissionais/agenda,
# enfileirar um turno e conferir myia_agent_runs (cache_read_tokens > 0 no 2º turno)
```
**O que observar:** `cache_read_tokens` perto de zero em turnos repetidos significa que algo
volátil entrou antes do breakpoint do cache — a clínica pagaria 1x em vez de 0,1x, sem erro
nenhum. É a falha silenciosa mais cara do sistema.

### Passo 3 — P3.4: tools de escrita
Migration com **constraint de exclusão** (`btree_gist`) em `myia_appointments` contra duplo
agendamento — garantia no banco, não na lógica. Toda escrita revalida disponibilidade **dentro da
transação**: o modelo pode alucinar horário.

### Passo 4 — P3.5: escalonamento + envio real
`transferir_para_humano` → `myia_chat.chat_pause`. E **trocar o rascunho por envio**: hoje o
agente grava `status: PENDING` sem mandar nada (ver §7).

**Aqui a plataforma passa a atender de verdade.** P3.6/3.7/3.8 são melhorias em cima.

### Passo 5 — fechar as pendências do painel (contam para "100%")
```
[ ] Storage: migrar MinIO ou trocar por Supabase Storage (upload de imagem quebrado)
[ ] .env.local com valores reais de MinIO/webhook/mapbox
[ ] "Novo Chat" (src/app/(private)/chats/CreateChat) — onSubmit é console.log; o app NÃO
    sabe criar conversa (não há insert em myia_chat em lugar nenhum)
[ ] Abas SubAgents / Trainings / Integrations — UI sem nenhuma tabela por trás
[ ] Remover o código do Evolution (só DEPOIS do Cloud API provado)
[ ] Desligar os containers do Evolution no VPS
```

---

## 7. Comportamentos deliberados que parecem bug

Se você encontrar isto e achar que está quebrado — **não está**, foi escolhido:

1. **O worker nasce desligado.** `AGENT_TURN_ENABLED=false` por padrão, e ele loga alto. Um
   worker ligado com o turno não validado consumiria jobs sem responder ao paciente — pior que
   não rodar. O reaper roda mesmo desligado, para não deixar job preso.
2. **O agente grava rascunho, não envia.** `myia_messages.status = 'PENDING'`. Soltar o agente
   direto no paciente sem nunca ter rodado contra o modelo seria irresponsável. Trocar no P3.5.
3. **Catálogo não está no system prompt.** Serviços/profissionais/convênios vão por *tool*. Se
   entrassem no prompt, cadastrar um serviço invalidaria o cache da clínica inteira.
4. **Data/hora vai como `role: "system"` no fim de `messages`**, não no system prompt. No prompt
   destruiria o cache a cada requisição; e como mensagem de operador o paciente não consegue
   forjar ("hoje é 25 de dezembro").
5. **`identificar_paciente` não aceita parâmetro.** O paciente é o dono do chat. Aceitar número
   permitiria consultar cadastro de terceiros.
6. **Thinking fica ligado.** Em Opus 5, desligar tem um modo de falha em que a tool call sai como
   texto simples: o turno "sucede", a ferramenta nunca roda, nada acusa. Latência se controla por
   `AGENT_EFFORT`.

---

## 8. Armadilhas já descobertas (não caia de novo)

| Armadilha | Detalhe |
|---|---|
| **`tsconfig` da raiz não vê `.mts`** | `include: ["**/*.ts"]` NÃO casa `.mts`. O worker passou uma fase inteira sem checagem de tipo com `tsc` dizendo "sem erros". Use `npm run typecheck:worker`. |
| **`0009_grants.sql` concede tudo, inclusive para tabelas futuras** | `alter default privileges` faz toda tabela nova nascer legível pelo browser. Coluna de segredo exige `revoke` + grant por coluna. RLS filtra **linha**, não **coluna**. |
| **PostgREST não mira índice PARCIAL em `onConflict`** | Por isso `myia_enqueue_agent_turn` é função no Postgres, não upsert no supabase-js. |
| **`create policy` não aceita `IF NOT EXISTS`** | Migration reexecutada quebra. Sempre `drop policy if exists` antes. |
| **`check` dentro de `create table if not exists`** | Não é aplicado quando a tabela já existe. Constraint que pode mudar vai em `alter table` separado. |
| **Migration aplicada à mão pelo SQL editor** | A `0012` estava no banco mas não registrada; o push seguinte quebrou. Use `supabase migration repair`. |
| **Middleware exclui `/api/*`** | Rotas de API não recebem auth do middleware. Quem usa service role autentica o chamador via Bearer JWT (`src/lib/auth/tenant.ts`). |
| **Node type stripping não transforma código** | Nada de `enum`, parameter property ou decorator em `worker/`. |
| **Aviso `SecretsUsedInArgOrEnv` no build do Docker** | **Falso positivo** — dispara pelo NOME da variável. Já investigado: a imagem final não tem segredo nenhum. Não perca tempo. |
| **Bypass de login em dev foi REMOVIDO** | O middleware plantava um `authData` falso que tornava `/login` inalcançável em dev. Era a causa raiz do "login não redireciona". Não reintroduza. |

---

## 9. Comandos úteis

```bash
# Testes
npm run test:unit            # 31, sem rede
npm run test:integration     # worker + tools, escreve e limpa o banco
npm run typecheck:worker     # o tsc da raiz NÃO cobre worker/
node scripts/db-test.mjs supabase/tests/0014_agent_jobs.test.sql

# Banco
npx supabase migration list --linked
npx supabase db push --linked
npx supabase migration repair --status reverted 00NN --linked

# Deploy (sobe app + worker)
bash scripts/deploy-app-vps.sh
DEPLOY_WORKER=0 bash scripts/deploy-app-vps.sh   # só o painel

# VPS
ssh root@80.190.72.243 "docker ps"
ssh root@80.190.72.243 "docker logs --tail 50 auri-agent-worker"
```

---

## 10. Dívidas técnicas conhecidas

- **`myia_services.tempo_medio` é TEXT livre** ("30 min", "1h", "45"). `worker/tools.mts` tem um
  parser defensivo com default de 30 min. O certo é uma coluna `duration_minutes integer`.
- **`myia_channels.token`/`urlapi` legíveis pelo cliente** (tracker #14 do Plano 2). Some sozinho
  quando o código do Evolution for removido.
- **`src/services/MessageService.ts` tem 1457 linhas** e chama o Evolution direto do browser. Sai
  junto com o Evolution.
- **`ContactImage` ignora `width`/`height` no fallback** (bolinha fixa em 46px). Contornado
  inline no menu do estado vazio dos chats.
- **`page_client-reference-manifest` warning no build** — pré-existente, não bloqueia; os deploys
  passam com ele.
- **Senha root do VPS foi exposta em transcript** de sessão anterior — o acesso por chave já está
  configurado; resetar a senha no painel da Contabo continua pendente.
