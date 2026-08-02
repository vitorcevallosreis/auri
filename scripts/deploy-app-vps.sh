#!/usr/bin/env bash
#
# deploy-app-vps.sh — build + deploy do app Next.js (container) no VPS.
#
# Rodado do MAC LOCAL. Faz rsync do repo pro VPS, builda a imagem Docker LÁ e
# sobe o container co-locado com o Evolution API na mesma rede docker.
#
# O container escuta em 127.0.0.1:3000 (loopback do VPS). A exposição pública e
# o repoint do nginx (wa.auri.global -> app) são feitos À PARTE pelo maestro —
# este script NÃO mexe em nginx nem em TLS.
#
# Uso:
#   bash scripts/deploy-app-vps.sh
#   VPS_HOST=root@1.2.3.4 APP_DIR=/opt/auri-app bash scripts/deploy-app-vps.sh
#
# Env file (APP_ENV_FILE, default ../.night-work/app-deploy.env) — criado pelo
# maestro com os valores REAIS. Formato KEY=VALUE, uma por linha. Deve conter:
#
#   # --- build-time (NEXT_PUBLIC_*: o Next inlina no bundle) ---
#   NEXT_PUBLIC_SUPABASE_URL=...
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
#   NEXT_PUBLIC_SUPABASE_STORAGE_URL=...
#   NEXT_PUBLIC_APP_URL=https://wa.auri.global
#   NEXT_PUBLIC_WEBHOOK=...
#   NEXT_PUBLIC_MINIO_SERVER_URL=...
#   NEXT_PUBLIC_MINIO_BUCKET=...
#   NEXT_PUBLIC_CHANNEL_API=            # opcional (página /test-minio)
#   NEXT_PUBLIC_CHANNEL_NAME=           # opcional
#   NEXT_PUBLIC_CHANNEL_TOKEN=          # opcional — INLINADA NO BROWSER, não usar token real
#   NEXT_PUBLIC_TEST_PHONE=             # opcional
#   # --- runtime (server-only; nunca vão pro build) ---
#   SUPABASE_SERVICE_ROLE_KEY=...
#   EVOLUTION_API_URL=http://evolution_api:8080
#   EVOLUTION_API_KEY=...
#   EVOLUTION_WEBHOOK_SECRET=...
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Parâmetros
# ---------------------------------------------------------------------------
VPS_HOST="${VPS_HOST:-root@80.190.72.243}"
APP_DIR="${APP_DIR:-/opt/auri-app}"
IMAGE_TAG="${IMAGE_TAG:-auri-app:latest}"
CONTAINER_NAME="${CONTAINER_NAME:-auri-app}"
WORKER_IMAGE_TAG="${WORKER_IMAGE_TAG:-auri-agent-worker:latest}"
WORKER_CONTAINER_NAME="${WORKER_CONTAINER_NAME:-auri-agent-worker}"
# Plano 3 P3.2: o worker sobe junto por padrão. DEPLOY_WORKER=0 pula (útil para
# um deploy só do painel).
DEPLOY_WORKER="${DEPLOY_WORKER:-1}"
DOCKER_NETWORK="${DOCKER_NETWORK:-evolution_evolution-net}"
HOST_PORT="${HOST_PORT:-127.0.0.1:3000}"

# Raiz do repo (o script vive em scripts/), independente de onde foi chamado.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ENV_FILE="${APP_ENV_FILE:-${REPO_ROOT}/../.night-work/app-deploy.env}"

# Envs lidas em RUNTIME pelo server.js (entram no --env-file do docker run).
RUNTIME_KEYS=(
  # Duas gerações de chave secreta. src/lib/supabase/server.ts e o worker
  # preferem SUPABASE_SECRET_KEY e caem para SUPABASE_SERVICE_ROLE_KEY;
  # mandar as duas permite migrar sem um deploy intermediário quebrado.
  SUPABASE_SERVICE_ROLE_KEY
  SUPABASE_SECRET_KEY
  EVOLUTION_API_URL
  EVOLUTION_API_KEY
  EVOLUTION_WEBHOOK_SECRET
  # --- WhatsApp Cloud API + agente (Plano 3) ---
  META_APP_ID
  META_APP_SECRET
  META_WEBHOOK_VERIFY_TOKEN
  META_GRAPH_VERSION
  WHATSAPP_TOKEN_ENC_KEY
  AGENT_DEBOUNCE_SECONDS
  # O worker precisa da URL do Supabase em runtime; no app ela é inlinada no
  # build, mas o worker não passa por build do Next.
  NEXT_PUBLIC_SUPABASE_URL
  # Default do worker é DESLIGADO (turno do agente é stub até o P3.3).
  AGENT_TURN_ENABLED
  WORKER_POLL_INTERVAL_MS
  WORKER_CLAIM_BATCH
  WORKER_REAP_TIMEOUT_SECONDS
  # --- Agente (P3.3). O worker usa; desde a escuta do prontuário, o APP
  #     também fala com a Anthropic (rota /api/prontuario/escuta). ---
  ANTHROPIC_API_KEY
  AGENT_MODEL
  AGENT_EFFORT
  AGENT_MAX_TOKENS
  AGENT_HISTORY_LIMIT
  AGENT_CACHE_TTL
  AGENT_SEND_ENABLED
  # --- Prontuário: escuta por IA e prescrição digital ---
  # Nenhuma delas existe hoje em `app-deploy.env`, e o script pula as vazias —
  # as duas features sobem DESLIGADAS, mostrando na tela que não estão
  # configuradas. Estão listadas aqui para que ligá-las depois seja preencher o
  # env file, e não descobrir que o valor nunca chegava ao container.
  TRANSCRICAO_PROVIDER
  TRANSCRICAO_API_KEY
  TRANSCRICAO_MODELO
  ESCUTA_MODEL
  # A SECRET da Memed é server-only e não pode virar NEXT_PUBLIC_ nunca.
  MEMED_API_KEY
  MEMED_SECRET_KEY
  MEMED_API_URL
  MEMED_SCRIPT_URL
)

# Envs inlinadas no BUILD (--build-arg). Devem casar com os ARG do Dockerfile.
BUILD_KEYS=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  NEXT_PUBLIC_SUPABASE_STORAGE_URL
  NEXT_PUBLIC_APP_URL
  NEXT_PUBLIC_WEBHOOK
  NEXT_PUBLIC_MINIO_SERVER_URL
  NEXT_PUBLIC_MINIO_BUCKET
  NEXT_PUBLIC_CHANNEL_API
  NEXT_PUBLIC_CHANNEL_NAME
  NEXT_PUBLIC_CHANNEL_TOKEN
  NEXT_PUBLIC_TEST_PHONE
)

# Obrigatórias: sem elas o build/boot quebra (config.ts e server.ts dão throw).
REQUIRED_KEYS=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_APP_URL
  EVOLUTION_API_URL
  EVOLUTION_API_KEY
  EVOLUTION_WEBHOOK_SECRET
)

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERRO: %s\033[0m\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1. Validar env file
# ---------------------------------------------------------------------------
log "Lendo env file: ${APP_ENV_FILE}"
[[ -f "${APP_ENV_FILE}" ]] || die "env file não encontrado: ${APP_ENV_FILE}
Crie-o com os valores reais (veja o cabeçalho deste script)."

# Carrega o env file sem vazar no log. `set -a` exporta tudo que for atribuído.
set -a
# shellcheck disable=SC1090
source "${APP_ENV_FILE}"
set +a

missing=()
for k in "${REQUIRED_KEYS[@]}"; do
  [[ -n "${!k:-}" ]] || missing+=("$k")
done

# As chaves do Supabase existem em duas geracoes (legada e nova). Exigir um nome
# fixo bloquearia justamente a migracao: basta UMA das duas de cada par.
for pair in \
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  "SUPABASE_SECRET_KEY SUPABASE_SERVICE_ROLE_KEY"
do
  read -r nova legada <<<"$pair"
  if [[ -z "${!nova:-}" && -z "${!legada:-}" ]]; then
    missing+=("${nova} (ou a legada ${legada})")
  fi
done

if (( ${#missing[@]} > 0 )); then
  die "faltam variaveis obrigatorias em ${APP_ENV_FILE}: ${missing[*]}"
fi
log "env file OK (${#BUILD_KEYS[@]} build-args, ${#RUNTIME_KEYS[@]} runtime)"

# ---------------------------------------------------------------------------
# 2. Sincronizar o repo pro VPS
# ---------------------------------------------------------------------------
log "rsync ${REPO_ROOT} -> ${VPS_HOST}:${APP_DIR}"
ssh "${VPS_HOST}" "mkdir -p '${APP_DIR}'"
rsync -az --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude ".next" \
  --exclude ".env" \
  --exclude ".env.*" \
  --exclude ".DS_Store" \
  --exclude ".night-work" \
  "${REPO_ROOT}/" "${VPS_HOST}:${APP_DIR}/"

# ---------------------------------------------------------------------------
# 3. Montar o env-file de RUNTIME no VPS (só as chaves server-only)
# ---------------------------------------------------------------------------
# Gerado a partir do env file local; fica com permissão 600 no VPS.
log "Enviando envs de runtime para ${APP_DIR}/.env.runtime (chmod 600)"
runtime_env_content=""
for k in "${RUNTIME_KEYS[@]}"; do
  if [[ -n "${!k:-}" ]]; then
    runtime_env_content+="${k}=${!k}"$'\n'
  fi
done
printf '%s' "${runtime_env_content}" | \
  ssh "${VPS_HOST}" "cat > '${APP_DIR}/.env.runtime' && chmod 600 '${APP_DIR}/.env.runtime'"

# ---------------------------------------------------------------------------
# 4. Build da imagem no VPS
# ---------------------------------------------------------------------------
# Monta os --build-arg a partir das BUILD_KEYS presentes.
build_args=()
for k in "${BUILD_KEYS[@]}"; do
  build_args+=(--build-arg "${k}=${!k:-}")
done

log "docker build ${IMAGE_TAG} no VPS (pode demorar alguns minutos)"
ssh "${VPS_HOST}" \
  "cd '${APP_DIR}' && docker build $(printf '%q ' "${build_args[@]}") -t '${IMAGE_TAG}' ."

# ---------------------------------------------------------------------------
# 5. Garantir a rede e (re)subir o container — idempotente
# ---------------------------------------------------------------------------
log "Verificando rede docker '${DOCKER_NETWORK}'"
ssh "${VPS_HOST}" "docker network inspect '${DOCKER_NETWORK}' >/dev/null 2>&1 || {
  echo 'Rede ${DOCKER_NETWORK} não existe. O Evolution API está rodando?' >&2
  exit 1
}"

log "Parando/removendo container antigo (se existir)"
ssh "${VPS_HOST}" "docker rm -f '${CONTAINER_NAME}' >/dev/null 2>&1 || true"

log "Subindo ${CONTAINER_NAME} em ${HOST_PORT} na rede ${DOCKER_NETWORK}"
ssh "${VPS_HOST}" "docker run -d \
  --name '${CONTAINER_NAME}' \
  --restart always \
  --network '${DOCKER_NETWORK}' \
  -p '${HOST_PORT}:3000' \
  --env-file '${APP_DIR}/.env.runtime' \
  '${IMAGE_TAG}'"

# ---------------------------------------------------------------------------
# 5b. Worker do agente (Plano 3, P3.2)
# ---------------------------------------------------------------------------
# Container separado: a Meta exige ack do webhook em ~5s e um turno do agente
# leva segundos. Sem build de assets — o worker roda TypeScript direto com
# --experimental-strip-types.
if [[ "${DEPLOY_WORKER}" == "1" ]]; then
  log "docker build ${WORKER_IMAGE_TAG} no VPS"
  ssh "${VPS_HOST}" \
    "cd '${APP_DIR}' && docker build -f Dockerfile.worker -t '${WORKER_IMAGE_TAG}' ."

  log "Parando/removendo worker antigo (se existir)"
  # SIGTERM primeiro: o worker tem shutdown gracioso e termina os jobs em voo,
  # evitando deixá-los presos em 'running' até o reaper.
  ssh "${VPS_HOST}" "docker stop -t 35 '${WORKER_CONTAINER_NAME}' >/dev/null 2>&1 || true"
  ssh "${VPS_HOST}" "docker rm -f '${WORKER_CONTAINER_NAME}' >/dev/null 2>&1 || true"

  log "Subindo ${WORKER_CONTAINER_NAME} na rede ${DOCKER_NETWORK}"
  # Sem -p: o worker não expõe porta, só consome a fila.
  ssh "${VPS_HOST}" "docker run -d \
    --name '${WORKER_CONTAINER_NAME}' \
    --restart always \
    --network '${DOCKER_NETWORK}' \
    --env-file '${APP_DIR}/.env.runtime' \
    '${WORKER_IMAGE_TAG}'"

  # Sem porta para bater: a prova de vida é o log de boot.
  sleep 3
  if ssh "${VPS_HOST}" "docker logs --tail 20 '${WORKER_CONTAINER_NAME}' 2>&1 | grep -q 'iniciando'"; then
    log "WORKER OK — ${WORKER_CONTAINER_NAME} de pé"
    ssh "${VPS_HOST}" "docker logs --tail 5 '${WORKER_CONTAINER_NAME}' 2>&1" || true
  else
    printf '\n\033[1;31mWorker não iniciou. Logs:\033[0m\n' >&2
    ssh "${VPS_HOST}" "docker logs --tail 50 '${WORKER_CONTAINER_NAME}' 2>&1" >&2 || true
    die "worker não subiu. Veja os logs acima."
  fi
else
  log "DEPLOY_WORKER=0 — pulando o worker"
fi

# ---------------------------------------------------------------------------
# 6. Healthcheck
# ---------------------------------------------------------------------------
log "Healthcheck em http://${HOST_PORT} (até 60s)"
if ssh "${VPS_HOST}" "
  for i in \$(seq 1 30); do
    if curl -fsS -o /dev/null 'http://${HOST_PORT}'; then
      echo 'app respondeu OK'
      exit 0
    fi
    sleep 2
  done
  exit 1
"; then
  log "DEPLOY OK — ${CONTAINER_NAME} respondendo em ${HOST_PORT}"
  echo "Próximo passo (maestro): apontar o nginx (wa.auri.global) para http://${HOST_PORT}"
else
  printf '\n\033[1;31mHealthcheck FALHOU. Logs do container:\033[0m\n' >&2
  ssh "${VPS_HOST}" "docker logs --tail 50 '${CONTAINER_NAME}'" >&2 || true
  die "app não respondeu em ${HOST_PORT}. Veja os logs acima."
fi
