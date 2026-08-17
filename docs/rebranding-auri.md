# Rebranding Nexa → Auri — mapeamento e plano de adaptação

Fonte: `Plataforma de Marca _ Auri.pdf` (63 páginas, Núcleo 03 = Identidade).
Levantado em 2026-07-29 contra o estado atual de `feat/plan2-evolution-ingress`.

---

## 1. O que a marca define

### Paleta (p48) — regra 60/30/10

| Papel | HEX | HSL (para os tokens shadcn) | Uso |
|---|---|---|---|
| Dominante (60%) | `#11282C` | `189 44% 12%` | tom geral, superfícies escuras, texto forte |
| Secundária 01 (30%) | `#9EA9B7` | `214 15% 67%` | apoio, texto secundário |
| Secundária 02 | `#DEDEDE` | `0 0% 87%` | bordas, divisores, fundos sutis |
| Destaque 01 (10%) | `#68E2A5` | `150 68% 65%` | CTA, estados ativos, badges |
| Destaque 02 | `#FFFFFF` | `0 0% 100%` | — |
| "Preto" | `#0E0D0D` | `0 0% 5%` | texto máximo contraste |
| "Branco" | `#F0F0F0` | `0 0% 94%` | fundo de página |

### Tipografia (p50-52)

- Família: **Articulat CF** — pesos Light, Regular, Demi Bold, Dark
- Escala: H1 32-48pt · H2 24-32pt · H3 18-24pt · corpo 12-16pt · legendas 8-12pt · **botões/links 14-18pt**
- Entrelinha 120-150% · em telas, usar o topo de cada faixa

### Logotipo (p39-47)

Símbolo (recorte em "A", verde-menta) + wordmark "Auri" em `#11282C`.
Área de segurança = 1× a largura do "A" em todos os lados. Há variante secundária ("Assessoria").

### Grafismos (p53-54)

- Sempre recortes do ícone "A" — **nunca girados** (exceto 180° ao usar como faca de recorte)
- Nunca distorcidos (esticados/comprimidos)
- Coloridos para gerar contraste, sem atrapalhar leitura; variações de opacidade são encorajadas
- Preferir aplicações onde as quinas do "A" formam ângulos harmoniosos com o limite da arte

### Mood fotográfico (p55-56)

Profissional de saúde como herói, no centro. Nunca cara de banco de imagens. Jalecos são encorajados (combinam com a paleta). Predominância de azul, verde e cinza.

---

## 2. Como a plataforma está hoje

**A boa notícia:** o app já usa o sistema de tokens CSS do shadcn (`--primary`, `--accent`, `--border`... em HSL, em `src/app/globals.css`), e o `tailwind.config.ts` consome esses tokens. Trocar as variáveis re-veste o app inteiro de uma vez.

**A má notícia:** muita cor foi escrita fora dos tokens.

| Achado | Números |
|---|---|
| `#00897B` (teal atual) chumbado em componentes | **188 ocorrências** |
| Outros hex da família teal (`#007366`, `#00796B`, `#E0F2F1`, `#B2DFDB`) | ~46 ocorrências |
| Arquivos com hex chumbado | **43** |
| Referências textuais a "Nexa" | 7, em 5 arquivos |

Outras inconsistências encontradas:
- `tailwind.config.ts` declara `fontFamily.sans = ['SF Pro Display', ...]`, mas `src/app/layout.tsx` carrega **Poppins** via `next/font/google`. As duas coisas não conversam.
- Poppins é carregada só com `weight: "400"` — não há peso para títulos.
- Não existe nenhum asset de logo em `public/` (só `images/` e `sounds/`).

---

## 3. Duas descobertas que mudam decisões

### 3.1 Contraste do verde-menta — regra obrigatória

`#68E2A5` é uma cor **clara**. Medido:

| Combinação | Contraste | Veredito |
|---|---|---|
| Texto branco sobre `#68E2A5` | **1,6:1** | reprova (mínimo WCAG AA = 4,5:1) |
| Texto `#11282C` sobre `#68E2A5` | **9,6:1** | aprova com folga |

Ou seja: **botão de destaque = fundo menta + texto verde-petróleo**, nunca texto branco. Hoje o app faz botão verde com texto branco (funciona porque `#00897B` é escuro). Trocar a cor sem trocar a cor do texto quebraria a legibilidade de todos os CTAs.

### 3.2 Articulat CF é fonte comercial

Não está no Google Fonts. É da fundição Connary Fagen e exige **licença de webfont** separada da licença desktop — a de desktop não cobre uso em site/app. Precisa de decisão sua (ver seção 5).

---

## 4. Plano de adaptação — em camadas

Ordenado por relação impacto/esforço. Cada etapa é independente e verificável.

### Etapa 1 — Tokens globais ✅ CONCLUÍDA (2026-07-29)

Reescrever as variáveis em `src/app/globals.css` (temas claro e escuro):

```
--background      0 0% 94%     /* #F0F0F0 */
--foreground      189 44% 12%  /* #11282C */
--primary         189 44% 12%  /* #11282C — estrutura, sidebar, headers */
--primary-foreground  0 0% 100%
--accent          150 68% 65%  /* #68E2A5 — CTA e estados ativos */
--accent-foreground   189 44% 12%   /* CRÍTICO: dark sobre menta (9,6:1) */
--muted-foreground    214 15% 67%   /* #9EA9B7 */
--border / --input    0 0% 87%      /* #DEDEDE */
--ring            150 68% 65%
```

Sozinha, essa etapa já muda tudo que usa os tokens corretamente. **Não** muda as 188 ocorrências chumbadas — o app fica visualmente misto até a Etapa 3.

**Resultado medido em produção** (`/billing`, após deploy): fundo da página `rgb(240,240,240)` = `#F0F0F0` ✅ · borda de card `rgb(222,222,222)` = `#DEDEDE` ✅ · **21 de 432 elementos** ainda com o teal antigo (`#00897B` chumbado) — é exatamente o escopo da Etapa 3.

Dois desvios conscientes da paleta, ambos por acessibilidade e documentados no próprio `globals.css`:
`--accent-foreground` é o petróleo (não branco) sobre o menta; e `--muted-foreground` no tema claro usa o matiz do cinza da marca escurecido para 46% de luminosidade.

### Etapa 2 — Tipografia ✅ CONCLUÍDA (2026-07-29) — Hanken Grotesk

**Achado principal:** a Poppins era carregada só no peso 400, mas a interface
renderiza 500 e 700 em vários lugares. Ou seja, **todo o negrito da plataforma
era sintético** (faux bold desenhado pelo navegador). Agora os 4 pesos reais
(300/400/600/700) são carregados — confirmado em produção via `document.fonts`.

**Bug corrigido de tabela:** `src/hooks/useFonts.ts` exportava objetos de fonte
usados como `` className={`${text_ligth} ...`} `` — interpolar o objeto produz a
string `"[object Object]"`, então a classe emitida era lixo e a fonte nunca era
aplicada. Havia ainda `clsx(text_ligth, ...)`, pior: o clsx trata objeto como
mapa de classes condicionais e emitia as *chaves* (`className style variable`)
como nomes de classe. Os 10 usos viraram utilitários de peso do Tailwind
(`font-light`/`font-normal`/`font-semibold`) e o arquivo foi removido.

Ganho colateral: a Hanken Grotesk é mais estreita que a Poppins, e rótulos que
quebravam em duas linhas nas tabelas agora cabem em uma.

**Escala:** medida antes de mexer. O app já estava quase conforme — corpo 16px
(topo da faixa 12-16 ✓), entrelinha 120-150% ✓, botões 14px ✓. Só o H1 está em
30px, 2px abaixo do piso de 32 da marca, porque a página usa `text-3xl`
explícito que vence o padrão de base. Não forcei a troca em cada tela para não
gerar churn de layout por 2px — ver seção 7.

#### Sobre a fonte original (Articulat CF)

Substituto aprovado da Articulat CF. Está no Google Fonts (OFL, sem custo, sem
licença de webfont a comprar), é uma grotesca geométrica de proporções próximas,
e tem a faixa de pesos que a marca pede (300/400/600/700).

- Trocar Poppins por Hanken Grotesk via `next/font/google`
- **Remover o `@import` morto na linha 1 do `globals.css`**: ele pede
  "SF Pro Display" ao Google Fonts, fonte que não existe lá (é da Apple) — a
  requisição nunca funcionou
- Alinhar `tailwind.config.ts` (hoje declara `SF Pro Display`, que não bate com
  o `layout.tsx`) para apontar para a variável da fonte real
- Carregar os 4 pesos: Light 300, Regular 400, Demi Bold 600, Dark 700
  (hoje Poppins vem só com 400 — não há peso para títulos)
- Aplicar a escala da marca nos utilitários de heading
- Alinhar `tailwind.config.ts` → remover 'SF Pro Display', apontar para a fonte real
- Carregar os 4 pesos (Light 300, Regular 400, Demi Bold 600, Dark 700)
- Aplicar a escala da marca nos utilitários de heading

### Etapa 3 — Varredura dos hex chumbados ✅ CONCLUÍDA (2026-07-29)

**229 ocorrências → 0.** 222 estavam em classes Tailwind de valor arbitrário
(substituição segura, preservando prefixos `hover:`/`focus:`); 7 exigiram
tratamento manual.

Mapeamento aplicado (por papel, não por cor):

| Antes | Depois | Nota |
|---|---|---|
| `text-/border-/bg-/from-[#00897B]` | `*-primary` | cor de marca |
| `bg-[#007366]`, `bg-[#00796B]` | `bg-primary/90` | **todas as 28** ocorrências de teal escuro eram `hover:` |
| `text-[#00796B]`, `text-[#007366]` | `text-primary/80` | idem |
| `ring-[#00897B]` | `ring-ring` | sempre em `focus:` → anel de foco vira menta |
| `bg-[#E0F2F1]`, `to-[#E0F2F1]` | `bg-accent/20` | tint de badge |
| `bg-[#B2DFDB]` | `bg-accent/30` | hover do badge (tint mais forte) |

Os 7 casos manuais:
- `globals.css` — scrollbar do chat (3): viraram `hsl(var(--primary))`
- `company_specialties` — dois ícones lucide com `color="#00897B"`: viraram
  `className="text-primary"` (lucide usa `currentColor` por padrão)
- `InteractionsChart` (2) — **Chart.js pinta em `<canvas>`, onde `hsl(var(--x))`
  não resolve** porque o canvas não participa da cascata do CSS. Em vez de
  chumbar o hex novo e recriar o problema, o componente agora lê o valor cru do
  token via `getComputedStyle` e monta a cor — segue o tema automaticamente.

**Medido em produção após deploy:** `/billing` → 0 elementos com teal antigo,
253 com o petróleo da marca. `/assistants` → 0 antigos, 186 petróleo, badges em
`rgba(105,226,166,0.2)` (o menta a 20%).

#### Calibragem do destaque (decidida após ver o resultado)

A varredura deixou tudo monocromático — o menta só sobrava em tint de badge e
anel de foco. Decisão: **trazer o menta para os estados ativos**, mantendo os
botões em petróleo.

Regra que guiou a implementação: **o menta é fundo, nunca traço.** Como cor de
texto ou ícone sobre fundo claro ele rende 1,6:1 e desaparece; como fundo
tingido com conteúdo petróleo por cima, rende 13,6:1 (medido no item ativo).
Só é usado sólido em elementos decorativos que não carregam texto (a barra
lateral do item ativo, o sublinhado da aba).

Aplicado em:
- `sidebar.tsx` — item ativo: `bg-accent/25` + barra sólida menta à esquerda
  (via `before:`); item em destaque: `bg-accent/15`
- `billing/page.tsx` — sublinhado da aba ativa: `border-accent`

### Etapa 4 — Nome e identidade ✅ CONCLUÍDA (2026-07-29)

Decisões: **Hanken Grotesk** mantida (sem Adobe Fonts por ora) e família de
ícone **Principal** (não a "Softwares").

- Novo `src/components/brand/auri-logo.tsx` com dois componentes inline:
  `<AuriLogo>` (lockup) e `<AuriIcon>` (só o símbolo).
  **Por que inline e não `<img src>`:** o wordmark usa `currentColor`, então
  herda a cor do texto e serve aos dois temas com um único arquivo — sem
  duplicar assets nem piscar na troca de tema. O símbolo mantém o menta fixo
  (é a cor de destaque da marca, não deve variar). Verificado em produção: no
  tema escuro o wordmark resolve para `rgb(240,240,240)` sozinho.
- `sidebar.tsx` — lockup quando expandido, só o símbolo quando recolhido
  (o ícone `Bot` do lucide, que era placeholder, saiu)
- `auth-layout.tsx` — logo no login/cadastro/recuperação
- 6 textos "Nexa" → "Auri" em 3 arquivos
- Favicon: `src/app/icon.svg` (convenção de arquivo do Next) + cópias em
  `public/brand/`
- Título da aba: era **inexistente** (a aba mostrava a URL crua). Como o layout
  raiz é `"use client"` e não pode exportar `metadata`, foi adicionado nos
  layouts de rota `(private)` e `(public)` — este último criado para isso.

#### Legado NÃO tocado (de propósito)

`nexa` sobrevive em identificadores internos que não são marca: nome do schema
antigo em arquivos de teste, bucket `nexa-whatsapp`, URLs mortas de
`webhooks.sejanexa.com.br` e o prefixo de canal `nexa_${company_id}` em
`contexts/Assistants`. Renomear esses exige coordenação com infra/dados —
não é troca de texto.

### Etapa 4 (original) — Nome e identidade

- 7 ocorrências de "Nexa" → "Auri" (`sidebar.tsx`, `auth-layout.tsx`, `(private)/page.tsx`, `Company/index.tsx`, `TestimonialsSection.tsx`)
- Logo: hoje o sidebar usa o ícone `Bot` do lucide como placeholder → trocar pelo SVG real (depende da decisão 5.2)
- Favicon e `<title>`
- Área de segurança do logo (1× largura do "A") ao posicionar no sidebar e no login

### Etapa 5 — Grafismos e auditoria premium ✅ CONCLUÍDA (2026-07-29)

Novo `src/components/brand/auri-grafismo.tsx` (variantes preenchido e contorno,
opacidade configurável). O componente **impede por construção** as violações do
manual: `viewBox` preservado e sem `preserveAspectRatio="none"`, então a forma
nunca estica; nenhuma rotação exposta como prop.

Aplicado no painel do login e nos estados vazios do chat e de assistentes.
No login o grafismo é ancorado às bordas superiores do painel — o manual pede
que as quinas do "A" formem ângulos harmoniosos com o limite da arte, o que não
acontecia quando ele era cortado num canto arbitrário.

#### Componente `Empty` (novo)

Criado `src/components/ui/empty.tsx` seguindo a composição oficial do shadcn.
Antes cada tela improvisava seu estado vazio, com espaçamentos e tamanhos de
ícone diferentes. Aplicado em chat, assistentes, canais e dispositivos.

⚠️ **Não rodei `shadcn init`**: o projeto usa componentes no estilo shadcn mas
nunca foi inicializado pelo CLI (`config: null`). O `init` reescreveria
`globals.css` e destruiria a paleta Auri. O componente foi transcrito à mão a
partir da fonte oficial.

#### Novo token: `brand`

`--brand` / `--brand-foreground` — sempre o petróleo dominante, **não invertem
com o tema**. Necessário porque `primary` troca entre petróleo e menta, o que é
certo para botões e errado para uma peça de marca: o painel do login virava um
bloco menta gigante no tema escuro.

#### Dependências externas removidas

| O que era | Onde | Problema |
|---|---|---|
| 4 fotos do **Unsplash** rotuladas "Paciente" | estado vazio do chat | O manual proíbe foto com cara de banco de imagens (p56). Ainda hot-linkava um CDN de terceiros e vinha com um dropdown falso (nomes fictícios, `href="#"`) e classes `hs-*` do Preline, biblioteca **não instalada** |
| Logo do WhatsApp em **PNG da Wikipedia** | 4 telas | Depender de terceiro para a tela renderizar; raster borrado em retina; a Wikimedia pede que não usem como CDN. Virou SVG local |
| Bandeiras do **flagsapi.com** | seletor de país (2 telas) | Dependência externa por 2 ícones. Viraram emoji. O `alt` dizia "Argentina" para BR e EUA |

#### Autofill do Chrome

O Chrome pinta campos preenchidos com um azul próprio (`rgba(70,90,126,.4)`)
que ignora `background-color` — a tela de login saía da paleta toda vez que o
usuário voltava. Corrigido com `box-shadow` interno + `-webkit-text-fill-color`.

#### Agenda abre no horário comercial

A grade cobre 24h e abria em 0:00, com a madrugada vazia ocupando a tela.
`WeekView` e `DayView` agora rolam até as 7h na montagem. A grade continua
cobrindo 24h de propósito — encurtá-la esconderia encaixes fora do horário.

### Etapa 5 (original) — Grafismos e refinamento

- Recortes do "A" como elemento decorativo em telas vazias (`ChatEmpty`, "Nenhum assistente personalizado"), respeitando as regras de não-rotação
- Revisão de espaçamento e raio de borda
- Mood fotográfico nos avatares/ilustrações

---

## 5. Decisões que travam a execução

### 5.1 Articulat CF — ✅ RESOLVIDO

Decidido usar **Hanken Grotesk** (Google Fonts, OFL) no lugar. Sem custo e sem
licença de webfont a adquirir. Ver Etapa 2.

### 5.2 Arquivos do logo — ✅ RECEBIDOS

Pasta `Logotipo e Assets Visuais/` na raiz do projeto, em SVG e PNG:

- **Logotipo** (lockup completo) — 5 variantes: Verde e Escuro, Verde Escuro,
  Verde e Cinza, Cinza, Verde Claro
- **Ícone** — em 3 famílias: Principal, **Softwares**, Assessoria — cada uma em
  Verde Escuro / Verde Claro / Cinza
- **Grafismos** — Preenchido e Contorno, nas mesmas 3 cores

Para o app: a família **"Ícone Softwares"** é a indicada (é a variante pensada
para produto digital). Etapa 4 desbloqueada.

### 5.4 Licenciamento da Articulat CF — atenção

A pasta `Tipografia/fonts/` contém `.otf` da Articulat CF baixados do
**fonnts.com**, site que redistribui fontes comerciais sem licença. Esses
arquivos **não foram instalados** — publicá-los num site expõe o projeto a
infração de direito autoral, e existe caminho oficial.

O próprio `Tipografia/Links Importantes.docx` aponta as fontes legítimas:

| Caminho | Observação |
|---|---|
| **Adobe Fonts** — `fonts.adobe.com/fonts/articulat-cf` | Uso **web incluído** via Web Project. Se já há assinatura Creative Cloud, é custo zero e dá a fonte real da marca |
| Compra direta — `connary.com/fonts/articulat/` | Licença de webfont própria, self-hosted |
| **Hanken Grotesk** (em uso) | OFL, custo zero, sem pendência jurídica |

### 5.3 Profundidade — ✅ RESOLVIDO

Execução **etapa por etapa**, com validação a cada uma antes de seguir.

---

## 6. Achado sério: o tema escuro está ilegível

Descoberto ao validar o logo no tema escuro. **54 de 79 textos visíveis** na tela
de billing ficam abaixo do mínimo de contraste AA. O pior caso é o título da
página (`text-3xl font-bold text-gray-900`), que dá **1,00:1** — literalmente a
mesma cor do fundo, invisível.

**Não é regressão do rebranding.** A causa são classes de cinza fixas
(`text-gray-900`, `text-gray-600`, `text-gray-700`) espalhadas pelas telas, que
não reagem ao tema. O tema escuro anterior também era escuro
(`--background: 222.2 47.4% 11.2%`), então o problema já existia — só não tinha
sido percebido porque ninguém usou o modo escuro.

### Etapa 6 — Correção do tema escuro ✅ CONCLUÍDA (2026-07-29)

**Resultado: 54 textos ilegíveis → 0**, medido nos dois temas em `/billing` e
`/assistants`.

**544 substituições** ao todo:

| Mudança | Qtd | Razão |
|---|---|---|
| `text-gray-900/800/700` → `text-foreground` | | invertem com o tema |
| `text-gray-600/500/400` → `text-muted-foreground` | 480 no total | idem |
| `bg-gray-50/100/200` → `bg-muted`, `border-gray-*` → `border-border` | | idem |
| `bg-white` → `bg-card` | 43 | cartão branco fixo + texto que inverte = texto claro sobre branco |
| `text-white` → `text-primary-foreground` (só em elementos com `bg-primary`) | 21 | no escuro o primary é MENTA, e branco sobre menta dá 1,6:1 |

**Proteção que tornou a varredura segura:** o regex usa lookbehind `(?<!dark:)`.
As classes `dark:bg-gray-800` e afins **já são** o tratamento de tema existente —
convertê-las quebraria o tema claro. Sem essa proteção a varredura teria trocado
o problema de lugar.

**Dois bugs meus, encontrados na validação e corrigidos:**
1. Item ativo do sidebar usava `text-primary`. Funciona no claro (petróleo sobre
   tingido menta), mas no escuro `--primary` **é** o menta → menta sobre menta,
   **1,00:1**. Trocado por `text-foreground`.
2. Mesmo erro nos badges e botões outline criados na Etapa 3
   (`bg-accent/20 text-primary`). Trocados por `text-accent-foreground`, que é
   petróleo nos dois temas (12,51:1 sobre o tingido).

Lição registrada: **sobre fundo menta, o texto deve ser `accent-foreground`;
`primary` só serve quando o fundo não é o próprio accent.**

## 7. 🔴 Achado crítico fora do escopo de branding: agendamento estava quebrado

Encontrado durante a varredura de dependências externas.

**A criação de agendamento não funcionava.** O botão "Nova Consulta" usa o
`MultiStepAppointmentForm`, e o `handleSubmit` dele:

1. montava `appointmentData` no formato certo,
2. **nunca chamava `createAppointment`** (a função estava importada e ociosa),
3. fazia `await fetch` para `webhooks.sejanexa.com.br/webhook/created-schedule`,
   que era quem gravava E checava conflito.

Esse host **não responde** — o DNS resolve (`back.sejanexa.com.br`,
`170.205.37.73`) mas o TCP não conecta. Então o `await` pendurava até o timeout
e caía no `catch`: "Erro ao realizar agendamento". Nenhum agendamento jamais era
salvo pelo formulário.

**Corrigido:** o fluxo agora grava no Supabase via `createAppointment` e checa
conflito com uma query de sobreposição (mesmo profissional, mesma data, faixas
que se cruzam, ignorando cancelados).

Uma armadilha encontrada no caminho: `appointmentData` incluía `temp_id`, coluna
que **não existe** em `myia_appointments` (era campo só do payload do n8n). O
insert seria rejeitado inteiro. O campo é removido antes de gravar.

**Testado contra o banco real**, 6 casos incluindo os limites:

| Faixa nova | vs. 10:00–11:00 existente | Resultado |
|---|---|---|
| 10:30–11:30 | sobrepõe | conflito ✅ |
| 09:30–10:15 | sobrepõe | conflito ✅ |
| 10:00–11:00 | idêntico | conflito ✅ |
| 09:00–10:00 | encosta antes | livre ✅ |
| 11:00–12:00 | encosta depois | livre ✅ |
| 13:00–14:00 | distante | livre ✅ |

⚠️ **Limite conhecido, precisa da sua decisão:** só a sobreposição objetiva foi
reconstruída. Se o n8n aplicava regras adicionais — bloqueios de agenda,
feriados, intervalo mínimo entre consultas, limite de encaixes — elas **não**
existem mais, e não há como inferi-las do código restante. Vale revisar antes de
a clínica operar em volume.

### 7.1 Cadastro de profissional — mesmo problema, deliberadamente NÃO corrigido

`CreateProfessional/model.ts` faz `axios.post` para
`webhooks.sejanexa.com.br/webhook/salva-profissional` e **não escreve no
Supabase em momento algum**. Mesmo padrão do agendamento: o n8n era a camada de
escrita. Logo, **cadastrar profissional também está quebrado**.
`ProfessionalEditModal.tsx` usa o mesmo host (editar-profissional).

**Por que parei aqui em vez de corrigir:** o agendamento era um insert único,
que dava para verificar exaustivamente contra o banco. Este fluxo escreve em
**três** tabelas e tem três ambiguidades reais:

| Campo do form | Destino provável | Ambiguidade |
|---|---|---|
| `specialties: string[]` | `especialidade text` | coluna é **singular**; existe `myia_specialties` à parte — qual é a fonte da verdade? |
| `services[].amount` / `.tipo` | `myia_professional_services.price` / `.mode` | `max_people` não existe no form |
| `schedule` (record por dia) | `myia_professional_availability` | mapeamento de dia→`weekday` (1=Segunda?) e a origem de `max_simultaneous_clients` não são inferíveis |

A terceira é a que me fez parar: `myia_professional_availability` é o que diz à
IA **quando o profissional atende**. Um mapeamento errado de `weekday` faria o
agente marcar pacientes em dias que o médico não trabalha — num produto de
saúde, isso é dano real, não bug cosmético. Prefiro 2 minutos de conversa a um
palpite.

O resto do mapeamento (`nome`, `formacao`, `registro`, `email`, `telefone`,
`quem_atende`→`atende_cat_idade`, `agreements`→`convenios_aceitos`) é direto e
está pronto para ser escrito assim que as três dúvidas forem resolvidas.

## 8. Correções em trabalho meu de etapas anteriores

Encontradas ao auditar os dois temas com o tema aplicado **pelo próprio app**
(e não alternando a classe `.dark` na mão — o `next-themes` reaplica a classe e
a medição saía de um estado misto, o que me deu números falsos duas vezes).

1. **`muted-foreground` reprovava sobre o fundo da página.** Na Etapa 1 validei
   `214 15% 46%` contra o **card** (`#FFFFFF`, 4,83:1) e dei por bom. Mas o
   fundo da página é `#F0F0F0`, onde caía para **4,24:1**. Corrigido para
   `42%`, que passa nos três fundos claros existentes: página 4,91 · card 5,60 ·
   muted 4,57.

2. **`accent-foreground` sobre TINT de menta quebrava no escuro.** Na Etapa 6
   troquei `text-primary` por `text-accent-foreground` nos badges. Funciona no
   claro (petróleo sobre menta pálido), mas no escuro o tint de 20% sobre o
   petróleo vira verde escuro e o texto petróleo some (1,08:1). O correto sobre
   tint é `text-foreground`, que inverte com o tema.

   **Regra consolidada:** `accent-foreground` só com `bg-accent` **sólido**;
   sobre `bg-accent/NN` (tint) use `foreground`.

3. **Regex larga demais.** A varredura do item 2 converteu um
   `hover:text-accent-foreground` legítimo em `navigation-menu.tsx` — ele
   pareava com `bg-accent` sólido, mas havia um `bg-accent/50` adiante na mesma
   string de classes. Revertido.

4. **Opacidade do logo no grupo em vez de por caminho.** O SVG da marca aplica
   `opacity: .8` em **cada** caminho; eu apliquei no `<g>`. O SVG achata o grupo
   antes do alpha, então a sobreposição das duas asas do "A" sumia e o símbolo
   virava um bloco sólido. Corrigido nos dois componentes.

## 9. Verificação

- `npm run build` limpo a cada etapa
- Revisão visual das 8 rotas do menu (`/`, `/appointments`, `/chats`, `/assistants`, `/billing`, `/company`, `/contacts`, `/settings`) + `/login` e `/register`
- Conferência de contraste dos pares texto/fundo introduzidos (mínimo AA 4,5:1 para corpo, 3:1 para texto grande)
- Tema escuro conferido junto do claro — os tokens têm as duas variantes e é fácil esquecer o `.dark`
