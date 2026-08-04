# Escuta do prontuário — decisões, medições e por onde trocar

Registro para quem for mexer nisto depois. Diz **o que escolhemos, por quê, o
que foi medido de verdade** e **por qual peça trocar** quando alguma não
servir. Última atualização: **2026-08-04**.

O código está em `src/lib/escuta/` e `src/app/api/prontuario/escuta/route.ts`.
Este documento não repete o que os comentários do código já dizem — ele
registra as alternativas descartadas e o motivo, que é o que não cabe no
código.

---

## O que a feature faz

Consentimento → `MediaRecorder` no navegador → `POST /api/prontuario/escuta`
→ transcrição → um modelo redige o rascunho → prontuário nasce com
`source='ai'` e `review_status='pending'` → o médico revisa e assina pelas
telas de 0022/0024.

---

## Decisões que não se negociam

Estas vieram do usuário e valem independentemente de stack.

### 1. O áudio NUNCA é armazenado

Vai do navegador ao transcritor e é descartado. `myia_listening_sessions` não
tem coluna de áudio, e `supabase/tests/0025_listening_sessions.test.sql` FALHA
se alguém adicionar uma — a varredura procura por `audio|recording_url|blob|media`.

A **transcrição**, sim, é guardada: é a única forma de auditar o rascunho
contra a fonte. E o médico não pode reescrevê-la — a policy
`listening_professional_read` é `SELECT` apenas; escrita só pelas RPCs.

### 2. Consentimento é `not null` no schema

Não é checagem de tela. A obrigação de LGPD não pode depender do cliente, e a
sessão é criada **antes** de o microfone ligar.

### 3. Transcrição é um adaptador, nunca chamada direta

**A Claude API não aceita áudio — Claude não transcreve.** A transcrição é
sempre de terceiro, e qual terceiro é decisão de negócio: muda preço,
qualidade em português, se separa as vozes, e em que país o áudio de um
paciente brasileiro é processado.

---

## Stack atual (2026-08-04) e por que ela

| Ponta | Escolha | Onde roda |
|---|---|---|
| Transcrição | `hwdsl2/whisper-server`, modelo `medium`, diarização ligada | **No nosso VPS**, container `auri-whisper` |
| Redação | Groq, `openai/gpt-oss-120b` com `strict: true` | Externo |

**Por que assim.** O usuário pediu stack gratuita para validar. O áudio é o
dado mais sensível do sistema, então ele fica na nossa máquina; só a
transcrição em texto sai. É um meio-termo consciente entre privacidade,
qualidade e custo zero.

O container **não publica porta** (sem `-p`): só é alcançável por
`http://auri-whisper:9000` de dentro da rede do Docker.

---

## Medições reais (não estimativas)

VPS Contabo, **4 vCPU AMD EPYC, 7,8 GB RAM, sem GPU**. Amostra: 31s de fala
clínica em português com negações e termos médicos.

| Modelo | Tempo | RAM | Qualidade |
|---|---|---|---|
| `small` | 31s | 777 MB | "dor torácica" → **"doutorássica"**; "ausculta" → **"aos culta"**; "omeprazol" → "homeprasol" |
| `medium` | 60s | 2,0 GB | acerta "dor torácica", "sem febre", "ausculta pulmonar", "ruídos adventícios" |

**`small` foi descartado para uso clínico.** Ele derrete exatamente os termos
médicos, que são o conteúdo do prontuário. Numa amostra anterior chegou a
transformar "sem febre" em "Cephebre" — perder a negação é a classe de erro
que inverte o significado clínico.

### ⚠️ Ressalva importante sobre estas medições

**A amostra é fala SINTÉTICA** (`say` do macOS), não voz humana em consulta
real. Whisper é treinado em fala real; TTS pode ser mais fácil ou mais difícil
que o mundo real. Os números de tempo e RAM são confiáveis; **os de qualidade
são indicativos, não conclusivos**. Antes de confiar nisso em produção, meça
com gravação de consulta real (com consentimento).

### Erro de estimativa que vale registrar

O plano original dizia "~6x tempo real, consulta de 15 min transcreve em 2,5
min", com base em benchmark de terceiros. **O real nesta máquina é ~1x com
`small` e ~2x com `medium`** — uma consulta de 15 min leva ~30 min com
`medium`. Não repita a estimativa; meça.

---

## O problema em aberto: a transcrição é síncrona

`route.ts` transcreve **dentro da requisição HTTP** (`maxDuration = 300`,
nginx com `proxy_read_timeout 300s`).

Com `medium` a ~2x tempo real, **isso limita a consulta a ~2,5 minutos**.
Serve para testar o fluxo inteiro; **não serve para consulta real**.

Aumentar o timeout não resolve: manter uma requisição HTTP aberta por 30
minutos é frágil por natureza — qualquer queda de rede, reinício de container
ou fechamento de aba perde a consulta.

### O caminho certo: fila, como o agente já faz

O projeto **já tem** a peça: `myia_agent_jobs` + `worker/index.mts`, com
claim, reaper e shutdown gracioso. O desenho seria:

1. `POST /api/prontuario/escuta` recebe o áudio, enfileira e responde na hora.
2. O worker transcreve e redige, movendo `myia_listening_sessions.status`
   pelos estados que **já existem**: `transcribing` → `drafting` → `done`.
3. A tela acompanha o status — a sessão já é consultável por RLS.

O áudio precisaria de um lugar temporário entre a requisição e o worker
(volume do container ou bucket com expiração curta), **e apagá-lo depois é
requisito, não detalhe** — ver decisão 1.

O schema de 0025 já suporta isso sem migration: os estados intermediários
existem justamente porque este caminho estava previsto.

---

## Por qual stack trocar, e quando

Toda troca é **uma variável de ambiente**, exceto onde indicado. Ver
`src/lib/escuta/transcricao.ts` e `redacao.ts`.

### Transcrição

| Situação | Troque para | Como |
|---|---|---|
| Qualidade insuficiente e privacidade negociável | **Groq** `whisper-large-v3-turbo` | `TRANSCRICAO_BASE_URL=https://api.groq.com/openai/v1` + `TRANSCRICAO_API_KEY`. Grátis: 2.000 req/dia, 25 MB/arquivo. **O áudio passa a sair do país.** |
| Precisa de qualidade clínica e diarização paga | **Deepgram** `nova-3-medical` | `TRANSCRICAO_PROVIDER=deepgram` + `TRANSCRICAO_API_KEY`. Provedor já implementado. |
| Ganhou GPU | mantenha self-hosted, suba o modelo | `WHISPER_MODEL=large-v3-turbo` e recrie o container |
| RAM apertando | `WHISPER_MODEL=small` | **último recurso** — ver a tabela de qualidade acima |

⚠️ **O servidor Whisper IGNORA o campo `model` da requisição.** O modelo é o do
container (`WHISPER_MODEL`). Trocar exige recriar o container; mudar a chamada
não faz nada — foi assim que descobrimos, com três modelos devolvendo saída
idêntica byte a byte.

### Redação

| Situação | Troque para | Como |
|---|---|---|
| Escala / qualidade máxima | **Anthropic** (o alvo) | `ESCUTA_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`. É o padrão do código. |
| Validar sem custo | **Groq** | `ESCUTA_PROVIDER=openai-compat`, `ESCUTA_BASE_URL=https://api.groq.com/openai/v1`, `ESCUTA_API_KEY` |
| Nada pode sair da máquina | Ollama / vLLM local | Mesmo `openai-compat`, apontando para o endereço local |

⚠️ **`strict: true` só existe em alguns modelos.** No Groq: `openai/gpt-oss-20b`
e `openai/gpt-oss-120b`. Nos demais, `json_schema` é sugestão, não garantia — e
o que sai dali vai **direto** para `content` do prontuário. Se trocar de modelo,
confirme que ele suporta decodificação restrita, ou aceite validar a saída por
conta própria.

⚠️ **Um LLM local pequeno (7B) foi avaliado e descartado**: com 5,5 GB livres e
sem GPU, a redação clínica em português ficaria fraca e levaria ~4 min por
prontuário. Se voltar a considerar, meça antes.

---

## Armadilhas já pagas

Coisas que custaram tempo e não são óbvias no código.

1. **O portão (`escutaDisponivel`) é crítico e já esteve errado.** Ele é
   consultado ANTES de o microfone ligar. Um falso positivo faz o médico
   conduzir a consulta inteira confiando na escuta e descobrir a falha ao
   encerrar — **a consulta não se repete**. A versão original checava
   `TRANSCRICAO_API_KEY && ANTHROPIC_API_KEY` e não validava o nome do
   provedor. Coberto agora por `scripts/test-escuta-portao.mts`; se mexer no
   portão, rode.

2. **A porta do Whisper é 9000**, não 8000.

3. **A imagem exige autenticação.** Ela gera um Bearer token sozinha no
   primeiro boot se `WHISPER_API_KEY` não for passada — e aí o app não sabe
   qual é. O deploy passa o mesmo valor de `TRANSCRICAO_API_KEY` como
   `WHISPER_API_KEY`.

4. **O volume `whisper-data` não é opcional.** Sem ele, cada restart rebaixa o
   modelo e a primeira consulta depois de cada deploy espera por isso.

5. **`Authorization: Bearer undefined` quebra alguns servidores.** Por isso o
   header só é enviado quando há chave — servidor em rede interna pode não
   pedir nenhuma.

6. **Transcrição salva não é recuperável pela tela.** Se a redação falhar,
   `route.ts` devolve `{ erro, transcricao }` e o texto fica no banco, mas
   `model.ts` lê só `json.erro` e descarta. Não há tela para sessões `failed`
   nem botão de "redigir de novo a partir da transcrição". **É a maior lacuna
   aberta** — o médico perde acesso à transcrição de uma consulta que não dá
   para repetir.

7. **`consent_method` está fixo em `'verbal'`** no front. A coluna aceita
   `'written'` e `consent_note` nunca é preenchida.

---

## Estado em 2026-08-04

- ✅ Container `auri-whisper` no ar, `medium`, diarização, sem porta publicada
- ✅ Adaptadores dos dois lados, com o portão consertado e testado (7 casos)
- ✅ Passo de subida no `scripts/deploy-app-vps.sh` (pula sozinho sem
  `TRANSCRICAO_API_KEY`; não derruba o deploy se o Whisper falhar)
- ⏳ **Falta a chave do Groq** — sem a ponta de redação o portão fica fechado,
  e corretamente: transcrever sem conseguir redigir produz áudio gravado e
  nenhum prontuário
- ⏳ **Assíncrono não implementado** — hoje o limite prático é ~2,5 min de
  consulta
- ⏳ Qualidade não validada com voz humana real
