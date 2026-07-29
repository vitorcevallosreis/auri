# Build do app Next.js 15 (App Router) em modo `output: "standalone"`.
# Multi-stage: deps -> builder -> runner. A imagem final roda `node server.js`.
#
# SEGREDOS: este Dockerfile NÃO contém nenhum valor secreto — só nomes de
# ARG/ENV. Os valores entram via `--build-arg` (build) e `--env-file` (runtime).
#
# IMPORTANTE — build-time vs runtime:
#   * NEXT_PUBLIC_*  => o Next INLINA no bundle durante `npm run build` (inclusive
#     no código de servidor, via DefinePlugin). Precisam ser --build-arg; passar
#     só no `docker run` NÃO funciona (viram `undefined` no bundle).
#   * Envs server-only (SUPABASE_SERVICE_ROLE_KEY, EVOLUTION_*) => lidas em
#     runtime pelo server.js. Entram no `docker run --env-file`, NUNCA no build
#     (senão ficariam gravadas nas camadas da imagem).

# ---------------------------------------------------------------------------
# Stage 1: deps — instala node_modules a partir do lockfile (cacheável)
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app

# libc6-compat: alguns binários nativos esperam glibc no Alpine.
RUN apk add --no-cache libc6-compat

# Só os manifests: mantém esta camada em cache enquanto o lockfile não mudar.
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# Stage 2: builder — compila o Next com as NEXT_PUBLIC_* inlinadas
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# --- NEXT_PUBLIC_* (build-time). Lista completa do que o código em src/ lê. ---
# Obrigatórias (o app quebra sem elas):
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SUPABASE_STORAGE_URL
ARG NEXT_PUBLIC_APP_URL
# Integrações:
ARG NEXT_PUBLIC_WEBHOOK
ARG NEXT_PUBLIC_MINIO_SERVER_URL
ARG NEXT_PUBLIC_MINIO_BUCKET
# Usadas apenas pela página de debug /test-minio (têm fallback no código; podem
# ficar vazias em produção). NEXT_PUBLIC_CHANNEL_TOKEN é inlinada no bundle do
# browser — não colocar um token real aqui.
ARG NEXT_PUBLIC_CHANNEL_API
ARG NEXT_PUBLIC_CHANNEL_NAME
ARG NEXT_PUBLIC_CHANNEL_TOKEN
ARG NEXT_PUBLIC_TEST_PHONE

# Reexporta como ENV para que o `next build` enxergue (ARG sozinho não vaza
# para o ambiente do RUN).
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SUPABASE_STORAGE_URL=$NEXT_PUBLIC_SUPABASE_STORAGE_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_WEBHOOK=$NEXT_PUBLIC_WEBHOOK \
    NEXT_PUBLIC_MINIO_SERVER_URL=$NEXT_PUBLIC_MINIO_SERVER_URL \
    NEXT_PUBLIC_MINIO_BUCKET=$NEXT_PUBLIC_MINIO_BUCKET \
    NEXT_PUBLIC_CHANNEL_API=$NEXT_PUBLIC_CHANNEL_API \
    NEXT_PUBLIC_CHANNEL_NAME=$NEXT_PUBLIC_CHANNEL_NAME \
    NEXT_PUBLIC_CHANNEL_TOKEN=$NEXT_PUBLIC_CHANNEL_TOKEN \
    NEXT_PUBLIC_TEST_PHONE=$NEXT_PUBLIC_TEST_PHONE

ENV NEXT_TELEMETRY_DISABLED=1

# `src/lib/supabase/server.ts` faz throw no import se SUPABASE_SERVICE_ROLE_KEY
# faltar. O build do Next importa esse módulo ao coletar as rotas de API, então
# precisamos de um valor PLACEHOLDER (não-secreto) só para o build passar. Em
# runtime o valor real vem do --env-file.
#
# O placeholder vai INLINE no RUN, e não como `ENV`, de propósito: como ENV ele
# virava uma camada da imagem e o BuildKit emitia
# `SecretsUsedInArgOrEnv: Do not use ARG or ENV instructions for sensitive data`.
# O aviso é falso positivo (dispara pelo NOME da variável, não pelo valor — que
# aqui é literalmente um placeholder, e num stage que é descartado), mas o ruído
# já levou a um diagnóstico errado de "a service role key está gravada na
# imagem". Inline no RUN o valor existe só durante o comando, e o aviso some.
RUN SUPABASE_SERVICE_ROLE_KEY="build-placeholder-not-a-real-key" npm run build

# ---------------------------------------------------------------------------
# Stage 3: runner — imagem final mínima
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Usuário não-root.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Assets públicos.
COPY --from=builder /app/public ./public

# .next/standalone já traz server.js + o node_modules mínimo do trace.
# .next/static NÃO vem no standalone — precisa ser copiado à parte.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Envs de RUNTIME esperadas via `docker run --env-file` (valores NUNCA aqui):
#   SUPABASE_SERVICE_ROLE_KEY, EVOLUTION_API_URL, EVOLUTION_API_KEY,
#   EVOLUTION_WEBHOOK_SECRET
CMD ["node", "server.js"]
