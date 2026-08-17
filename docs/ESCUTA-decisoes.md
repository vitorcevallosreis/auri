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

## A transcrição é ASSÍNCRONA (resolvido em 0027)

Até 0026 ela rodava dentro da requisição HTTP, o que limitava a consulta a
~2,5 minutos com `medium`. Aumentar timeout não resolveria: manter uma
requisição aberta por meia hora é frágil por natureza — queda de rede,
reinício de container ou a aba fechando perderiam a consulta.

Hoje: `POST /api/prontuario/escuta` grava o áudio no volume, enfileira e
responde **202**. O worker (`worker/escuta.mts`) transcreve e redige, movendo
`status` pelos estados que 0025 já tinha: `transcribing` → `drafting` →
`done`. A tela acompanha por poll de 5s e pode ser fechada — o prontuário
aparece na lista quando ficar pronto.

A fila é a PRÓPRIA `myia_listening_sessions`, com `for update skip locked`.
Não há tabela de jobs ao lado porque ela duplicaria a fonte da verdade.

**O worker usa `service_role`** e por isso NÃO pode usar as RPCs de 0025
(todas exigem `app_role() = 'professional'`). As portas dele derivam
`professional_id` e `company_id` **da própria sessão**, nunca de parâmetro —
recebê-los abriria escrita de prontuário em qualquer clínica para quem tivesse
a chave de serviço.

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

6. ~~**Transcrição salva não é recuperável pela tela.**~~ **FECHADO em 0028.**

   Era a maior lacuna aberta: o worker gravava a transcrição antes de redigir
   (justamente para que a falha não levasse o texto embora), e nada devolvia
   esse texto ao médico. A consulta — a única coisa irrepetível do sistema —
   ficava salva e inalcançável.

   O que existe agora:

   - `requeue_listening_draft()` (0028) devolve à fila uma sessão `failed`,
     para o modelo redigir de novo **a partir da transcrição já salva**. Não há
     áudio: 0027 o apaga assim que transcreve, e não há volta.
   - `claim_listening_sessions()` reivindica para `drafting`, não
     `transcribing`, quando `audio_path is null` — a tela não pode anunciar uma
     transcrição que não vai acontecer.
   - `processarEscuta()` (worker) trata os dois tipos de trabalho pelo mesmo
     discriminante: com áudio, transcreve e redige; sem áudio, só redige.
   - A tela `/pro/prontuario/escuta` lista as escutas que falharam **acima** da
     escolha do próximo atendimento, com o motivo, a transcrição atrás de um
     clique (dado clínico numa tela que pode estar aberta na frente do próximo
     paciente), botão de copiar e "Redigir de novo".

   **O que continua NÃO sendo possível: editar a transcrição.** Não há policy
   de UPDATE para o profissional (0025) e 0028 não criou nenhuma. A transcrição
   é a fonte contra a qual o rascunho se audita; uma fonte que o autor do
   rascunho pode reescrever não audita nada. Ler e copiar, sim.

   **Retentativa é humana, nunca automática.** `processarEscuta` continua
   marcando `failed` em vez de devolver à fila sozinho: repetir a mesma redação
   sem nada ter mudado só gasta o mesmo erro três vezes. Quem clica é alguém
   que pode ter corrigido o modelo, a chave ou o teto de tokens no meio — e
   `attempts` volta a zero por isso.

   **Sobra um caso sem saída:** falha ANTES de transcrever (Whisper fora do ar,
   áudio mudo). Aí não há texto e o arquivo já foi apagado — a tela diz isso e
   manda registrar à mão. Não há desenho que recupere áudio que não existe;
   quem quiser fechar esse caso teria que reter a gravação até o prontuário
   nascer, que é exatamente a troca de LGPD que 0027 recusou.

7. **`consent_method` está fixo em `'verbal'`** no front. A coluna aceita
   `'written'` e `consent_note` nunca é preenchida.

---

## Armadilhas do plano gratuito do Groq

Descobertas testando de verdade, e nenhuma delas aparece antes da primeira
consulta real.

1. **`max_completion_tokens` conta INTEIRO no limite de tokens por minuto.**
   O plano gratuito dá 8000 TPM. Com `ESCUTA_MAX_TOKENS=8000` (o default de
   `redacao.ts`), toda redação era recusada com **413** antes de começar:
   prompt ~640 + 8000 reservados = 8638 > 8000. Não importa que o modelo use
   200. Baixado para 3000. Com a Anthropic esse acoplamento não existe.

2. **Consulta longa vai bater no mesmo teto.** A transcrição entra no prompt:
   ~2500 tokens numa consulta de 15 min. Com 3000 de resposta ainda cabe, mas
   uma consulta de 40 minutos não vai caber. Quando isso acontecer, a saída é
   plano pago do Groq ou voltar para a Anthropic.

3. **`docker restart` NÃO recarrega o `--env-file`.** O ambiente é capturado
   quando o container é CRIADO. Mudar `.env.runtime` e reiniciar não muda
   nada — é preciso `docker rm -f` e `docker run` de novo. Custou duas
   rodadas de teste com o mesmo 413 depois de "já ter corrigido".

4. **O volume de áudio nasce pertencendo ao root** e os containers rodam como
   uid 1001. Sem `chown`, a primeira gravação morre com `EACCES` e a tela diz
   "Não consegui guardar a gravação" — depois de o médico ter conduzido a
   consulta inteira. O deploy já faz o chown; não remova esse passo.

---

## Teste ponta a ponta que passou (04/08/2026)

Amostra de 31s de fala clínica, pelo caminho real (sessão da médica, rota,
fila, worker):

```
t+0s   transcribing
t+40s  drafting
t+45s  done
```

Transcrição (Whisper `medium`, no VPS):
> "O paciente refere dor torácica a dois dias, sem febre, sem despneia, nega
> tabagismo e nega uso de anticoagulante, fez o uso de dipirona e omeprazole,
> ausculta pulmonar sem ruídos adventícios, hipótese diagnóstica, doença do
> refluxo gastroisofágico, solicito hemograma e eletrocardiograma."

Rascunho (`openai/gpt-oss-120b`, esquema estrito), já separado nos campos do
modelo SOAP — e note que o modelo CORRIGIU os erros da transcrição
("gastroisofágico" → "gastroesofágico", "despneia" → "dispneia"):

```json
{"chief_complaint":"dor torácica a dois dias",
 "anamnesis":"sem febre, sem dispneia, nega tabagismo, nega uso de anticoagulante, fez uso de dipirona e omeprazole",
 "physical_exam":"ausculta pulmonar sem ruídos adventícios",
 "assessment":"doença do refluxo gastroesofágico",
 "plan":"solicito hemograma e eletrocardiograma"}
```

Prontuário nasceu `source='ai'`, `review_status='pending'`, com procedência do
modelo na tela. **O áudio foi apagado do volume** (`audio_path` nulo).

Também exercitado o caminho de FALHA: áudio sem fala → "A transcrição voltou
vazia. O microfone pode não ter captado áudio." → sessão `failed`, áudio
apagado do mesmo jeito.

---

## Estado em 2026-08-04

- ✅ Container `auri-whisper` no ar, `medium`, diarização, sem porta publicada
- ✅ Adaptadores dos dois lados, com o portão consertado e testado (7 casos)
- ✅ Passo de subida no `scripts/deploy-app-vps.sh` (pula sozinho sem
  `TRANSCRICAO_API_KEY`; não derruba o deploy se o Whisper falhar)
- ✅ **Groq configurado** e a escuta LIGADA — portão devolve `disponivel: true`
- ✅ **Assíncrono implementado (0027)** — a transcrição saiu da requisição HTTP
  e roda no worker; não há mais limite prático de duração de consulta pelo
  lado do HTTP (o limite que sobra é o de tokens do Groq, acima)
- ⏳ Qualidade não validada com voz humana real
