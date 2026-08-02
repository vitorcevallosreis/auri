# Handoff — Prontuário clínico (escuta por IA, modelos, assinatura, Memed)

> Sessão de **2026-08-02**. Branch `feat/plan2-evolution-ingress`, último commit `8f8da09`.
> **Nada foi commitado** — todo o trabalho abaixo está no working tree.
> Este arquivo é irmão do [`HANDOFF.md`](./HANDOFF.md), que cobre o go-live do WhatsApp.
> São frentes distintas: aquele é ingress/agente, este é prontuário.

---

## 1. O que existe agora, em uma frase

O médico abre um prontuário (manual ou gerado pela escuta da consulta), o registro é
estruturado por um **modelo** que a clínica configura, ele revisa, **assina** e pode
**prescrever pela Memed** — e cada um desses atos tem fronteira no banco, não só na tela.

**Duas pontas não foram exercitadas de verdade** porque dependem de chaves que não existem
em nenhum ambiente local: a escuta (transcrição + Claude) e a Memed. Ver §6.

---

## 2. Migrations (0022–0026)

Todas **aplicadas** no Supabase `ffkicwhchrwvavkhfqol`, todas com suíte de teste passando.

| Migration | O que entrega |
|---|---|
| `0022_medical_records_sign.sql` | Assinatura eletrônica simples. RPC `sign_medical_record(uuid, 'review'\|'sign')`. |
| `0023_record_templates.sql` | `myia_record_templates` + `template_id`/`content` no prontuário + gatilho de compatibilidade + catálogo de **11 modelos do sistema**. |
| `0024_medical_records_write.sql` | `create_medical_record` e `save_medical_record` — criação e edição pelo médico. |
| `0025_listening_sessions.sql` | `myia_listening_sessions` (consentimento + transcrição) + `start`/`update`/`finish`. |
| `0026_memed_prescriptions.sql` | CPF/nascimento/conselho no profissional, `myia_prescriptions`, `record_prescription`, `parse_registro_conselho`. |

### A regra que atravessa todas elas

**O médico NUNCA tem policy de UPDATE em tabela clínica.** Toda escrita passa por função
`security definer` com a lista de colunas escrita à mão. O motivo está no comentário de 0022 e
vale para as cinco:

> Uma policy autoriza a LINHA, nunca a COLUNA. Com ela o médico passaria a poder reescrever
> anamnese e conduta direto pelo PostgREST — e sem deixar rastro de que o texto mudou depois de
> assinado, que é exatamente o que uma assinatura deveria impedir.

Grant por coluna também não resolve: grants são por role do Postgres, e dono e médico são os
dois `authenticated`.

**Se você for adicionar uma policy de UPDATE para o papel `professional`, pare e releia isto.**

### Estados terminais

- `review_status = 'signed'` → prontuário imutável (não edita, não reassina, não volta).
- `myia_listening_sessions.status = 'done'` → sessão fechada, existe prontuário do outro lado.
- Modelo do sistema (`company_id is null`) → só duplicável, nunca editável por clínica alguma.

---

## 3. Telas

### Área do médico (`/pro`)

| Rota | O que faz |
|---|---|
| `/pro/prontuario` | Lista + CTA de escuta + "Novo prontuário" + link para Modelos. |
| `/pro/prontuario/[id]` | Detalhe renderizado **pelo modelo**, modo de edição, revisar/assinar, prescrever, receitas emitidas. |
| `/pro/prontuario/novo` | Escolhe atendimento + modelo → cria e abre escrevendo. |
| `/pro/prontuario/modelos` | Catálogo (leitura) agrupado por especialidade. |
| `/pro/prontuario/escuta` | Consentimento → gravador (cronômetro + medidor de nível) → transcrição → rascunho. |

### Painel do dono (`/`)

| Rota | O que faz |
|---|---|
| `/record-templates` | Lista, separando modelos do sistema dos da clínica. |
| `/record-templates/[id]` | Editor (`new` cria, `?from=<id>` duplica). Arquiva em vez de apagar. |

Ligada pelo hub **Gestão Clínica** (`/company`), como 5º cartão.

### Design

Referência **prontus.ai** para estrutura (folha de rosto do paciente, grade de cartões com
ícone por seção, campo de destaque em superfície de marca), com a **paleta Auri** — o azul/verde
do Prontus não foi copiado. Detalhe importante: `--brand` não inverte com o tema, então no
escuro ele coincide com `--card`; o bloco de destaque leva um `ring-accent/40` para não virar
mais um cartão da grade.

---

## 4. Código novo

```
src/lib/escuta/transcricao.ts      adaptador de transcrição (Deepgram como referência)
src/lib/escuta/redacao.ts          Claude redigindo com o modelo virando esquema de saída
src/lib/memed/cliente.ts           token do prescritor (busca-ou-cria)
src/app/api/prontuario/escuta/     GET disponibilidade · POST áudio → prontuário
src/app/api/prontuario/prescricao/ GET token da Memed · POST registrar receita
src/hooks/useMedicalRecordWrite.ts criar/salvar prontuário, atendimentos sem prontuário
src/hooks/useRecordTemplateAdmin.ts CRUD de modelos (painel do dono)
src/components/professional/RecordFieldIcon.tsx   nome → ícone, com fallback
src/components/professional/MemedPrescricao.tsx   script + MdHub confinados aqui
```

### Autenticação das rotas `/api/*`

O middleware **exclui** `/api/*` e o cookie `authData` não é assinado. As duas rotas novas
criam um cliente Supabase **com o JWT do próprio médico** (`Authorization: Bearer`), em vez de
service role — assim as checagens de profissional/empresa dentro das RPCs continuam valendo.
Service role desligaria justamente essas checagens.

---

## 5. Como rodar as coisas

```sh
# Testes de banco (o pooler é necessário: o host direto é IPv6-only e não resolve aqui)
export SUPABASE_DB_URL="postgresql://postgres.<ref>:<senha>@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"
node scripts/db-test.mjs supabase/tests/0026_memed_prescriptions.test.sql

# Aplicar migration
node scripts/db-apply.mjs supabase/migrations/0026_memed_prescriptions.sql
```

⚠️ **NUNCA rode `npx next build` com o dev server no ar.** Os dois escrevem no mesmo `.next` e
o build derruba o dev com `ENOENT: _buildManifest.js.tmp`. Sequência correta:
`pkill -f "next dev"` → `npx next build` → `rm -rf .next` → `npm run dev`.

`scripts/db-test.mjs` foi alterado nesta sessão: o split por `;` agora respeita dollar-quotes,
então blocos `do $$ … $$` funcionam. Sem isso não dava para testar nenhuma asserção do tipo
"isto deveria levantar exceção" — que é a maioria das cinco suítes novas.

---

## 6. O que está PENDENTE

### 6.1 Memed — o bloqueio hoje é do lado deles

Atualizado em **02/08/2026**, depois de percorrer os três passos desta seção.

1. ✅ **Credencial de homologação configurada.** As chaves de sandbox são publicadas
   abertamente pela Memed em `doc.memed.com.br/docs/primeiros-passos` e estão no `.env.local`,
   com comentário dizendo que não são segredo e não valem em produção. As de produção só saem
   depois da validação técnica com eles.
2. ⛔ **A API de homologação da Memed está fora do ar.** `integrations.api.memed.com.br`
   devolve **503 em tudo**, inclusive na raiz — é o nginx de origem deles atrás do CloudFront,
   não uma questão de credencial ou de formato. Confirmado por IPv4 e IPv6. `api.memed.com.br`
   (outro host) responde 401, então o problema é específico do host de integrações.
   **É o único bloqueio restante, e não está nas nossas mãos.**
3. ✅ **O formulário do dono agora conhece os campos.** `DadosPrescricao.tsx` (bloco
   controlado, compartilhado) entrou no wizard de cadastro e no modal de edição; o modal de
   visualização mostra o que falta para cada profissional prescrever.
4. ⚠️ **Nenhum dos 12 profissionais tem CPF nem data de nascimento** — agora é digitação, não
   código. O conselho, esse, o backfill de 0026 preencheu a partir de `registro`.
5. **Não guardamos sexo do paciente**, obrigatório no `setPaciente` da Memed. Hoje é perguntado
   num diálogo na hora de prescrever. Se virar campo de cadastro, o diálogo sai.

**O que ficou provado nesta rodada:** com as chaves no ambiente, `/api/prontuario/prescricao`
carrega a config, lê o profissional pelo RLS dele, monta o prescritor e **chega a chamar a
Memed** — a tela do médico mostra o 503 que veio de lá. Toda a cadeia do nosso lado funciona
até a porta deles. O que continua sem rodar é o que só existe depois dessa porta: token do
prescritor, `MdHub`, `prescricaoImpressa` e `record_prescription`.

**Duas correções que só apareceram porque a chamada real aconteceu:**

- O `Content-Type` do POST era `application/vnd.api+json`; o exemplo cURL da doc usa
  `application/json` (o `Accept` é que é vnd.api+json). Era candidato a 415 mudo.
- A rota mandava a lista de campos faltantes **como causa** de qualquer erro. Com a Memed fora
  do ar, a tela dizia ao médico "peça à administração da clínica para completar seu cadastro" —
  o canal de suporte errado. Agora `dadosFaltando` só sai quando o cadastro é de fato a causa;
  o resto vira observação entre parênteses.

### 6.2 Escuta por IA — falta credencial

`TRANSCRICAO_API_KEY` e `ANTHROPIC_API_KEY` não existem localmente (nem como perfil do `ant`).
Sem as duas, `escutaDisponivel()` é false e a tela desabilita o microfone com aviso — de
propósito: a alternativa seria o médico conduzir a consulta inteira gravando para descobrir no
fim que não havia transcrição configurada.

**Claude não transcreve áudio** — a Messages API não aceita áudio. Por isso a transcrição é um
adaptador (`src/lib/escuta/transcricao.ts`); trocar de fornecedor é uma função nova + uma
variável de ambiente.

### 6.3 Decisões de produto já tomadas (não reabrir sem motivo)

- **O áudio da consulta NÃO é armazenado.** Vai do navegador ao transcritor e é descartado.
  `myia_listening_sessions` não tem coluna de áudio, e há teste em `0025` que **falha se alguém
  adicionar uma**. A transcrição, sim, é guardada — é a única forma de auditar o rascunho
  contra a fonte, e o médico não pode reescrevê-la.
- **O consentimento é `not null` no schema**, não checagem de tela. A sessão é criada ANTES de
  o microfone ligar.
- **Guardamos comprovante de receita, não a receita.** O documento assinado vive na Memed.

### 6.4 Pré-existente, não é regressão desta sessão

- `supabase/tests/0013_wa_cloud_channels.test.sql` **falha** (`policy de tenant ausente`).
  Confirmado com o runner original — não foi a alteração do `db-test.mjs`.
- **O histórico de migrations do Supabase não registra 0016+.** Elas foram aplicadas por
  `db-apply.mjs`, não por `supabase db push`. `npx supabase migration list` mostra `remote`
  vazio de 0016 em diante. Rodar `db push` tentaria reaplicar 0016–0026 — a maioria é
  idempotente, mas **não verifiquei uma por uma**.
- O breadcrumb do painel do dono mostra a rota crua e UUIDs (`record-templates > 7e000000-…`).
  Mesmo comportamento de `/services/[id]` — padrão da casa.
- A bolinha preta que cobre o "Sair" na sidebar é o `<nextjs-portal>`, indicador de dev do
  Next. **Não é bug**, não existe em produção. `devIndicators: false` no `next.config` some com
  ela se incomodar.

---

## 7. Estado dos dados

O banco está **como estava antes da sessão** em tudo que foi tocado para verificação:

- 1606 prontuários (o de teste que criei foi apagado a pedido).
- 11 modelos do sistema, 0 modelos de clínica (o de teste foi arquivado e removido).
- O prontuário que apontei para o modelo cardiológico foi revertido para SOAP.
- 2 prontuários de demo tiveram `review_status` alterado ao exercitar revisar/assinar
  (Rodrigo Gomes, 31/07) — é dado de demonstração, não corrigi.

---

## 8. Roadmap Tivita — onde paramos

Da tabela de escopo levantada a partir de `tivita.com`:

| Funcionalidade | Estado |
|---|---|
| Modelos de prontuário (+50 prontos ou próprios) | ✅ feito (11 do sistema + editor da clínica) |
| Assinatura digital | ✅ eletrônica simples feita. ICP-Brasil/certificado é projeto à parte |
| Prescrição digital (Memed) | ⚠️ código pronto e chamando a API; homologação deles em 503 (§6.1) |
| Escuta por IA (não existe na Tivita — nosso diferencial) | ⚠️ código pronto, falta credencial (§6.2) |
| Permissões por usuário / controle de logins | ❌ não iniciado. `myia_users.role` só distingue `owner`/`professional` |
| Prontuário especializado ABA (TABA) | ❌ não iniciado. Só faz sentido se ABA estiver no mercado-alvo |

---

## 9. Primeiro passo de quem pegar isto

1. Ler §2 (a regra do UPDATE) antes de tocar em qualquer migration clínica.
2. `node scripts/db-test.mjs` nas cinco suítes novas para confirmar que o banco continua são.
3. Se o assunto for Memed: §6.1 na ordem — credencial, depois cadastro do profissional,
   depois o formulário do dono.
