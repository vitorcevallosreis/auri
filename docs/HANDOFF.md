# Handoff — myia_app (Auri Software)

> **Para a próxima sessão:** leia este arquivo primeiro. Ele resume tudo que foi feito e
> o que vem a seguir, para você continuar sem re-derivar contexto. Atualizado: 2026-07-16.

---

## TL;DR

**myia_app** é um SaaS multi-tenant de **atendimento por IA no WhatsApp + agendamento** para
clínicas (Next.js 15 + Supabase + MinIO). Estava **inativo há ~1 ano**; estamos relançando numa
stack que controlamos e adicionando funcionalidades.

**Plano 1 (migração para Supabase próprio + religar painel) está COMPLETO, validado e MERGEADO na `main`**
(merge `--no-ff`, commit `15ff53e`, pushed). Review de pré-merge deu **0 bloqueadores**.

**Plano 2 (Evolution API self-host + ingress WhatsApp) está EM ANDAMENTO** na branch
`feat/plan2-evolution-ingress` (pushed) — ver a seção "Plano 2" abaixo. Feito na noite de 2026-07-15→16
numa sessão orquestrada (maestro + 2 agentes Maestri).

---

## Plano 2 — estado (branch `feat/plan2-evolution-ingress`)

**Contexto:** o gateway antigo de WhatsApp (n8n em `webhooks.sejanexa.com.br`) se perdeu. O Plano 2
reconstrói o gateway como infra nossa: Evolution API v2.3.7 self-hosted num VPS + rotas de
ingress/envio/gestão-de-canal no Next.js, gravando no Supabase via service role (Realtime atualiza a
inbox). **Escopo = só o gateway; a IA é o Plano 3.** Docs: `docs/superpowers/specs/2026-07-15-plano2-evolution-ingress-design.md`
(spec, com decisões marcadas 🔸DECISÃO p/ você revisar) e `docs/superpowers/plans/2026-07-15-plano2-evolution-ingress.md` (plano).

**JÁ FEITO E VERIFICADO (codável sem VPS):**
- **P2.0** fix do build de produção (era pré-existente, NÃO regressão do Plano 1): `force-dynamic` no
  layout privado — `npm run build` volta a passar. `src/app/(private)/layout.tsx`.
- **P2.1** migration `0011_whatsapp_ingress.sql` (índice em `myia_channels."instanceWpp"`; único parcial
  em `myia_messages(instance_id, message_id)` p/ dedup) + teste. **11/11 testes SQL passam**, aplicada na nuvem.
- **P2.2** envs server-only: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_WEBHOOK_SECRET` (em `.env.example`).
- **P2.3** rota de ingress `src/app/api/whatsapp/ingress/route.ts` — valida header `X-Auri-Webhook-Secret`,
  resolve tenant por `instanceWpp`, upsert contato/chat, insert idempotente de mensagem. **E2E testado
  via curl contra o Supabase dev** (grava, dedup, 401, drop de fromMe/grupo). Commit `837de03`.
- **P2.4** envio direto ao Evolution em `src/app/api/messages/send/route.ts` (substitui o n8n por
  `POST {urlapi}/message/sendText/{instance}`), **corrige um bug latente** (join por `channel_id`
  inexistente → agora resolve por `instanceWpp = chat.instance_id`), status SENT/FAILED; mídia = TODO
  fase 2. Commit `ec41762`.
- **P2.6** runbook de deploy do VPS: `docs/deploy/evolution-vps.md` (compose, nginx+TLS, webhook, backups). Commit `1df5d3e`.
- **P2.5** gestão de instância + religar UI de Channels: rota `src/app/api/whatsapp/instance/route.ts`
  (create/connect/logout/delete, API key GLOBAL server-only, persiste em `myia_channels`), `ChannelService`
  reescrito (n8n → rotas Next), UI `Channels`/context `Assistants` religados (createChannel devolve o canal
  → abre modal de QR; fixes de guardas de logout/delete). **Build limpo.** Commit `7037973`.
  ⚠️ Runtime contra o Evolution NÃO testado (precisa do VPS). Ponto de atenção a validar ao vivo: o
  envelope `webhook` embutido no `/instance/create` (usa `byEvents/base64`) pode precisar de ajuste.
- **Fix de segurança (review do P2.5 achou um IDOR cross-tenant):** `src/app/api/whatsapp/instance` é
  server-only via service role e o middleware **não** protege `/api/*` → sem auth, qualquer um pegaria o
  QR/token de outra empresa. Fechado no commit `8aa771d`: helper `src/lib/auth/tenant.ts` (valida o JWT do
  Supabase via `auth.getUser` → `company_id` de `myia_users`), auth 401, ownership nas 4 ações, segredos
  (`token`/`urlapi`) removidos das respostas, `ChannelService` manda `Authorization: Bearer`. **Build limpo.**

**PENDENTE:**
- **Auth PRÉ-EXISTENTE (não é regressão do Plano 2, mas fechar antes de escalar) — tracker #13:**
  `/api/messages/send` e `/api/messages/typing` têm a mesma ausência de auth/tenant (send tem 7+ call
  sites que precisariam mandar o Bearer — mudança ampla, testar sem quebrar a inbox); e
  `src/services/MessageService.ts` chama o Evolution **direto do browser** lendo `token`/`urlapi` (expõe
  segredo de instância ao client — mover pro servidor). `/typing` ainda tem o join quebrado `channel:channel_id`.
- **P2.7–P2.9 (precisa do VPS):** provisionar o VPS (🔸confirmar **Contabo SP** vs **Hetzner** — a spec
  recomenda Contabo SP por LGPD, alinhado ao Supabase em sa-east-1), subir o Evolution via o runbook,
  setar `EVOLUTION_API_*` reais, criar instância + parear QR, teste ponta-a-ponta ao vivo.

**Como o Plano 2 foi tocado:** sessão orquestrada — o maestro fez merge/spec/plano/integração/verificação;
Agent 1 fez review do Plano 1, build-check, e a implementação P2.0–P2.4 (parou no limite de uso; o
maestro finalizou/commitou o P2.4); Agent 2 fez a pesquisa do Evolution, o runbook, e o P2.5. Artefatos
de trabalho da noite (não versionados) em `../.night-work/` (research, review, reverse-engineering, drafts).
**Só falta a fase live (VPS)** para o Plano 2 rodar ponta a ponta.

---

## Estado do repositório

- **GitHub:** `https://github.com/vitorcevallosreis/auri` (privado).
- **`main`:** já tem o **Plano 1 mergeado** (`15ff53e`, `--no-ff`), pushed. Não usamos PR — merge local
  direto (o `gh` CLI **não** está instalado nesta máquina).
- **Branch de trabalho atual:** `feat/plan2-evolution-ingress` (base `main`, pushed). 4 commits do Plano 2.
- Dir local: `/Users/vitorcreis/CascadeProjects/Auri Software/myia_app-develop`.
- `git status` limpo, local == remote.

## Projeto Supabase (nosso)

- **Nome:** `myia-app` · **ref:** `ffkicwhchrwvavkhfqol` · **região:** `sa-east-1` (São Paulo, por
  LGPD/latência) · org `Auri` (`nsbzdlsiccvnrtecehtu`). Postgres 17.
- URL: `https://ffkicwhchrwvavkhfqol.supabase.co`.
- **Credenciais (gitignored, NÃO versionar):**
  - `.env.supabase-dev` — senha do DB + `SUPABASE_DB_URL` (conexão direta IPv6 `db.<ref>.supabase.co:5432`).
  - `.env.local` — `NEXT_PUBLIC_SUPABASE_URL`, anon key, `SUPABASE_SERVICE_ROLE_KEY`, storage URL.
- 🔐 **AÇÃO PENDENTE:** o Personal Access Token usado no `supabase login` vazou no histórico da
  sessão anterior. **Rotacionar** em https://supabase.com/dashboard/account/tokens.

## Ambiente / gotchas (importante)

Esta máquina **não tem Docker, Homebrew nem psql**. Por isso:
- Supabase CLI é **devDependency**: use `npx supabase ...` (nunca `supabase` global).
- Não usamos stack local — trabalhamos direto contra o **projeto na nuvem** (linkado).
- Runners SQL próprios (a lib `pg` é devDep):
  - `node scripts/db-test.mjs <arquivo.test.sql>` — roda asserções em transação com rollback;
    **PASS = zero linhas / exit 0**. Auto-carrega `SUPABASE_DB_URL` de `.env.supabase-dev`.
  - `node scripts/db-apply.mjs <arquivo.sql>` — aplica com COMMIT (usado no seed).
  - `node scripts/seed-auth.mjs` — cria usuários de LOGIN via Admin API (ver abaixo).
- **Aplicar migrations:** `set -a; source .env.supabase-dev; set +a` e
  `npx supabase db push -p "$SUPABASE_DEV_DB_PASSWORD"`.
- **Rodar o painel:** `npm run dev` (Next 15 + Turbopack, porta 3000).

## O que o Plano 1 entregou

- **Schema completo** reconstruído dos interfaces TS em `supabase/migrations/0001..0010`:
  tenancy, assistants, mensageria, catálogo, config da empresa, agendamento, **RLS multi-tenant**,
  fix `appointments.company_id NOT NULL`, **grants explícitos**, **publication de realtime**.
  Todas as ~20 tabelas usam prefixo `myia_`; isolamento por `company_id = auth_company_id()`.
- **RLS provado**: `supabase/tests/0009_isolation.test.sql` (controle positivo + negativo).
- **Painel religado**: `src/contexts/Auth/index.tsx` agora usa **Supabase Auth real**
  (`signInWithPassword`) e resolve `company_id` de `myia_users`. Fix crítico: cliente Supabase e
  subscriptions realtime foram de `schema: 'nexa'` → `'public'` (`src/lib/supabase/*`,
  `src/contexts/Company/index.tsx`). `src/database/types.ts` gerado (resolve import pendurado).
- **Validado ponta a ponta**: login real + leitura/escrita com RLS retornando só a própria clínica.
- **10/10 testes SQL passam** (`for t in supabase/tests/*.test.sql; do node scripts/db-test.mjs "$t"; done`).

### Usuários de teste
- **Login (via Admin API, senha `senha123`):** `clinica.a@teste.dev` → empresa A
  (`aaaaaaaa-...`), `clinica.b@teste.dev` → empresa B (`bbbbbbbb-...`).
- **Só para o teste de isolamento SQL (não logam):** `iso-a@internal.test` / `iso-b@internal.test`
  (ids fixos `11111111-...`/`22222222-...`). Motivo: `auth.users` inserido por SQL cru não cria
  `auth.identities`, então o GoTrue falha o login ("Database error querying schema"). **Sempre criar
  usuário de login via Admin API, nunca por INSERT em auth.users.**

## Follow-ups / issues conhecidos (NÃO feitos)

1. **`signUp`/auto-cadastro quebrado** (Important, fora do escopo do P1): `src/api/auth.ts`
   (`Register`) e `signUp` apontam pro schema antigo (colunas inexistentes; insert anon em
   `myia_companies` barrado por RLS, falha silenciosa). Precisa de **RPC SECURITY DEFINER de
   onboarding** que crie empresa + `myia_users` keyed no `auth.users.id`. Código morto p/ limpar:
   `Login`/`RefreshToken` em `auth.ts`, `src/api/auth_fixed.ts`, `auth_updated.ts`.
2. **Storage** (upload de imagem) não migrado — `MINIO_*`/storage ainda apontam para o ambiente
   antigo; buckets do Supabase novo não criados.
3. `.env.local` ainda tem valores antigos de MinIO/webhook/mapbox (placeholders).
4. Minors aceitos no review final (ver `.superpowers/sdd/` reports): `create policy` não idempotente;
   `updated_at` sem trigger (app seta manual); appointments não valida cross-tenant de
   professional/service; `%1$s` vs `%I` no format do RLS.

## Roadmap (cada um = ciclo spec → plano → implementação)

- **Plano 2 — Evolution API self-hosted + ingress WhatsApp** (o gateway antigo se perdeu).
- **Plano 3 — Agent Service (Claude Agent SDK)**: o "cérebro" do WhatsApp que substitui os fluxos
  n8n perdidos (agendar/consultar/FAQ/handoff/follow-ups como tools; personalidade vem da config do
  assistente no banco). **Nota:** Agent SDK/serviço em produção — NÃO os subagentes do Claude Code.
- Depois: backend financeiro (split payment + conciliação fiscal); prontuário por IA (com
  consentimento); plataforma de dados **RWE anonimizada/consentida** (NÃO vender dado identificável —
  LGPD art. 11); redesign UI/UX minimalista.

## Documentos de referência

- Spec: `docs/superpowers/specs/2026-07-15-foundation-relaunch-design.md`
- Plano 1: `docs/superpowers/plans/2026-07-15-plano1-migracao-supabase.md`
- Ledger de progresso e reports dos subagentes: `.superpowers/sdd/` (gitignored)
- Memória persistente: `~/.claude/projects/-Users-vitorcreis-CascadeProjects-Auri-Software/memory/`

## Como continuar (checklist p/ a próxima sessão)

1. `cd` no projeto; `git checkout feat/plan1-supabase-migration` (ou já mergeado? checar).
2. Confirmar que os testes passam: `set -a; source .env.supabase-dev; set +a; for t in supabase/tests/*.test.sql; do node scripts/db-test.mjs "$t"; done`.
3. Se for continuar o produto: começar o **Plano 2** via brainstorming (o usuário gosta do fluxo
   spec → plano → subagent-driven que usamos no Plano 1).
