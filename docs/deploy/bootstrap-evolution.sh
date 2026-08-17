#!/usr/bin/env bash
#
# bootstrap-evolution.sh — Bootstrap TURNKEY do Evolution API v2.3.7 num VPS.
#
# Automatiza o runbook docs/deploy/evolution-vps.md: hardening mínimo, Docker,
# ufw, Evolution + Postgres 15 + Redis 7 (só no loopback), nginx + TLS (certbot).
# Alvo: VPS Contabo São Paulo (ou equivalente) Ubuntu 22.04/24.04 RECÉM-CRIADO.
#
# USO (como root, ou via sudo):
#   WA_DOMAIN=wa.exemplo.com.br LETSENCRYPT_EMAIL=voce@exemplo.com.br \
#     sudo -E bash docs/deploy/bootstrap-evolution.sh
#
#   # opcionalmente reaproveitando um segredo de webhook já escolhido:
#   WA_DOMAIN=... LETSENCRYPT_EMAIL=... EVOLUTION_WEBHOOK_SECRET=<hex> \
#     sudo -E bash docs/deploy/bootstrap-evolution.sh
#
#   # re-renderizar os arquivos de config preservando os segredos (compose/.env/nginx):
#   ... sudo -E bash docs/deploy/bootstrap-evolution.sh --force
#
# PARÂMETROS (via variáveis de ambiente):
#   WA_DOMAIN                (obrigatório) subdomínio do Evolution; o A record já
#                            deve apontar para o IP público DESTE VPS.
#   LETSENCRYPT_EMAIL        (obrigatório) e-mail para o certbot.
#   EVOLUTION_VERSION        (opcional) default v2.3.7.
#   EVOLUTION_WEBHOOK_SECRET (opcional) se ausente, é gerado (openssl rand -hex 32).
#                            É o MESMO valor que vai no .env.local do app.
#
# IDEMPOTÊNCIA: seguro re-rodar. Os segredos são gerados UMA vez e persistidos em
# /opt/evolution/secrets.auri.env (chmod 600); re-execuções reaproveitam. Os
# arquivos docker-compose.yml / .env / nginx só são reescritos se não existirem —
# ou se você passar --force (sem trocar os segredos, para não perder as sessões
# pareadas nem quebrar o volume do Postgres). Para ROTACIONAR segredos, apague
# /opt/evolution/secrets.auri.env e rode com --force.
#
set -euo pipefail

# ---------------------------------------------------------------------------
# 0. Parâmetros e validação
# ---------------------------------------------------------------------------
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    *) echo "Argumento desconhecido: $arg" >&2; exit 2 ;;
  esac
done

WA_DOMAIN="${WA_DOMAIN:-}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-}"
EVOLUTION_VERSION="${EVOLUTION_VERSION:-v2.3.7}"

WORKDIR="/opt/evolution"
SECRETS_FILE="${WORKDIR}/secrets.auri.env"
COMPOSE_FILE="${WORKDIR}/docker-compose.yml"
ENV_FILE="${WORKDIR}/.env"
NGINX_SITE="/etc/nginx/sites-available/evolution"
NGINX_LINK="/etc/nginx/sites-enabled/evolution"

log()  { echo -e "\n\033[1;34m==>\033[0m $*"; }
ok()   { echo -e "  \033[1;32m✓\033[0m $*"; }
warn() { echo -e "  \033[1;33m! \033[0m$*"; }
die()  { echo -e "\n\033[1;31mERRO:\033[0m $*" >&2; exit 1; }

abort_if_missing() {
  local val="$1" name="$2"
  [ -n "$val" ] || die "variável obrigatória ausente: ${name}. Veja o cabeçalho do script (USO)."
}
abort_if_missing "$WA_DOMAIN" "WA_DOMAIN"
abort_if_missing "$LETSENCRYPT_EMAIL" "LETSENCRYPT_EMAIL"

# ---------------------------------------------------------------------------
# a. Checagens: root + DNS
# ---------------------------------------------------------------------------
log "a. Checagens iniciais"
[ "$(id -u)" -eq 0 ] || die "rode como root (ou via sudo). Ex.: sudo -E bash $0"
ok "root confirmado"

RESOLVED_IP="$(getent hosts "$WA_DOMAIN" 2>/dev/null | awk '{print $1}' | head -1 || true)"
if [ -z "$RESOLVED_IP" ]; then
  RESOLVED_IP="$(command -v dig >/dev/null 2>&1 && dig +short "$WA_DOMAIN" | tail -1 || true)"
fi
PUBLIC_IP="$(curl -fsS --max-time 10 https://ifconfig.me 2>/dev/null || curl -fsS --max-time 10 https://ipinfo.io/ip 2>/dev/null || true)"

if [ -z "$RESOLVED_IP" ]; then
  warn "não consegui resolver ${WA_DOMAIN} via DNS. O certbot vai FALHAR sem o A record apontando pra cá."
elif [ -n "$PUBLIC_IP" ] && [ "$RESOLVED_IP" != "$PUBLIC_IP" ]; then
  warn "DNS de ${WA_DOMAIN} = ${RESOLVED_IP}, mas o IP público deste host = ${PUBLIC_IP}. O certbot pode falhar."
else
  ok "DNS: ${WA_DOMAIN} -> ${RESOLVED_IP}${PUBLIC_IP:+ (IP do host: ${PUBLIC_IP})}"
fi

export DEBIAN_FRONTEND=noninteractive

# ---------------------------------------------------------------------------
# b. Sistema + dependências
# ---------------------------------------------------------------------------
log "b. apt update/upgrade + dependências"
apt-get update -y
apt-get upgrade -y
apt-get install -y \
  ca-certificates curl gnupg ufw nginx certbot python3-certbot-nginx dnsutils openssl
ok "pacotes base instalados"

# ---------------------------------------------------------------------------
# c. Docker Engine + compose plugin (repo oficial; idempotente)
# ---------------------------------------------------------------------------
log "c. Docker Engine + compose plugin"
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  ok "docker + compose plugin já presentes ($(docker --version))"
else
  install -m 0755 -d /etc/apt/keyrings
  if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
  fi
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  ok "docker instalado ($(docker --version))"
fi

# ---------------------------------------------------------------------------
# d. Firewall (ufw): só 22/80/443. NUNCA 8080/5432/6379.
# ---------------------------------------------------------------------------
log "d. Firewall (ufw)"
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow OpenSSH >/dev/null 2>&1 || ufw allow 22/tcp >/dev/null
ufw allow 80/tcp  >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
ok "ufw ativo — portas permitidas: 22, 80, 443 (8080/5432/6379 ficam no loopback)"

# ---------------------------------------------------------------------------
# e. Segredos (gerados 1x, persistidos, reaproveitados em re-runs)
# ---------------------------------------------------------------------------
log "e. Segredos"
mkdir -p "$WORKDIR"
if [ -f "$SECRETS_FILE" ]; then
  # shellcheck disable=SC1090
  source "$SECRETS_FILE"
  ok "segredos carregados de ${SECRETS_FILE} (não regenerados)"
  if [ -n "${EVOLUTION_WEBHOOK_SECRET:-}" ] && [ "${EVOLUTION_WEBHOOK_SECRET}" != "${WEBHOOK_SECRET:-}" ]; then
    warn "EVOLUTION_WEBHOOK_SECRET do ambiente difere do persistido; mantendo o persistido (apague ${SECRETS_FILE} p/ rotacionar)."
  fi
else
  # Reaproveita de um .env pré-existente (ex.: runbook manual), se houver.
  if [ -f "$ENV_FILE" ]; then
    AUTHENTICATION_API_KEY="$(grep -E '^AUTHENTICATION_API_KEY=' "$ENV_FILE" | cut -d= -f2- || true)"
    POSTGRES_PASSWORD="$(grep -E '^DATABASE_CONNECTION_URI=' "$ENV_FILE" | sed -n 's#.*://evolution:\([^@]*\)@.*#\1#p' || true)"
    [ -n "${AUTHENTICATION_API_KEY}${POSTGRES_PASSWORD}" ] && warn "reaproveitando segredos do ${ENV_FILE} existente"
  fi
  AUTHENTICATION_API_KEY="${AUTHENTICATION_API_KEY:-$(openssl rand -hex 32)}"
  POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(openssl rand -hex 24)}"
  WEBHOOK_SECRET="${EVOLUTION_WEBHOOK_SECRET:-$(openssl rand -hex 32)}"
  umask 077
  cat > "$SECRETS_FILE" <<EOF
# Segredos do bootstrap do Evolution (Plano 2 / Auri). NÃO versionar. chmod 600.
# Lidos por este script em re-execuções para não regenerar. Rotacionar = apagar.
AUTHENTICATION_API_KEY=${AUTHENTICATION_API_KEY}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
WEBHOOK_SECRET=${WEBHOOK_SECRET}
EOF
  chmod 600 "$SECRETS_FILE"
  ok "segredos gerados e salvos em ${SECRETS_FILE} (chmod 600)"
fi

# ---------------------------------------------------------------------------
# f. docker-compose.yml (idempotente; só reescreve se ausente ou --force)
# ---------------------------------------------------------------------------
log "f. docker-compose.yml"
if [ -f "$COMPOSE_FILE" ] && [ "$FORCE" -ne 1 ]; then
  ok "preservando ${COMPOSE_FILE} existente (use --force para reescrever)"
else
  cat > "$COMPOSE_FILE" <<EOF
services:
  evolution-api:
    container_name: evolution_api
    image: evoapicloud/evolution-api:${EVOLUTION_VERSION}
    restart: always
    depends_on:
      - postgres
      - redis
    ports:
      - "127.0.0.1:8080:8080"
    volumes:
      - evolution_instances:/evolution/instances
    env_file:
      - .env
    networks:
      - evolution-net

  postgres:
    container_name: evolution_postgres
    image: postgres:15
    restart: always
    command: postgres -c max_connections=1000 -c listen_addresses=*
    environment:
      - POSTGRES_DB=evolution
      - POSTGRES_USER=evolution
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - evolution-net
    expose:
      - "5432"

  redis:
    container_name: evolution_redis
    image: redis:7
    restart: always
    command: redis-server --appendonly yes
    volumes:
      - evolution_redis:/data
    networks:
      - evolution-net
    expose:
      - "6379"

volumes:
  evolution_instances:
  postgres_data:
  evolution_redis:

networks:
  evolution-net:
    driver: bridge
EOF
  ok "docker-compose.yml escrito (Evolution ${EVOLUTION_VERSION})"
fi

# ---------------------------------------------------------------------------
# g. .env de produção (idempotente; só reescreve se ausente ou --force)
# ---------------------------------------------------------------------------
log "g. .env de produção"
if [ -f "$ENV_FILE" ] && [ "$FORCE" -ne 1 ]; then
  ok "preservando ${ENV_FILE} existente (use --force para reescrever; segredos e sessões preservados)"
else
  umask 077
  cat > "$ENV_FILE" <<EOF
# ---------- Servidor / core ----------
SERVER_TYPE=http
SERVER_PORT=8080
SERVER_URL=https://${WA_DOMAIN}
LANGUAGE=pt-BR
TELEMETRY_ENABLED=false
DEL_INSTANCE=false

# ---------- Autenticação (CRÍTICO) ----------
AUTHENTICATION_API_KEY=${AUTHENTICATION_API_KEY}
AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true

# ---------- Banco (obrigatório na v2) ----------
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://evolution:${POSTGRES_PASSWORD}@postgres:5432/evolution?schema=public
DATABASE_CONNECTION_CLIENT_NAME=evolution_exchange
# Minimização de dados (LGPD): NÃO persistir conteúdo de mensagens no Evolution.
# O Supabase é a fonte de verdade. O conteúdo vai só para o seu webhook.
DATABASE_SAVE_DATA_INSTANCE=true
DATABASE_SAVE_DATA_NEW_MESSAGE=false
DATABASE_SAVE_MESSAGE_UPDATE=false
DATABASE_SAVE_DATA_CONTACTS=false
DATABASE_SAVE_DATA_CHATS=false

# ---------- Cache (Redis) ----------
CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=redis://redis:6379/6
CACHE_REDIS_PREFIX_KEY=evolution
CACHE_REDIS_TTL=604800
CACHE_REDIS_SAVE_INSTANCES=false
CACHE_LOCAL_ENABLED=false

# ---------- Webhook global (OFF; setamos por-instância no app) ----------
WEBHOOK_GLOBAL_ENABLED=false
WEBHOOK_GLOBAL_URL=''
WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS=false
WEBHOOK_REQUEST_TIMEOUT_MS=60000

# ---------- Sessão / QR ----------
CONFIG_SESSION_PHONE_CLIENT=Auri
CONFIG_SESSION_PHONE_NAME=Chrome
QRCODE_LIMIT=30
QRCODE_COLOR='#175197'

# ---------- CORS ----------
CORS_ORIGIN=*
CORS_METHODS=GET,POST,PUT,DELETE
CORS_CREDENTIALS=true
EOF
  chmod 600 "$ENV_FILE"
  ok ".env escrito (chmod 600)"
fi

# ---------------------------------------------------------------------------
# h. Subir os containers + aguardar healthcheck
# ---------------------------------------------------------------------------
log "h. docker compose pull + up"
cd "$WORKDIR"
docker compose pull
docker compose up -d
ok "containers subindo"

log "Aguardando o Evolution responder em http://127.0.0.1:8080/ (timeout ~90s)"
HEALTHY=0
for i in $(seq 1 30); do
  if curl -fsS --max-time 5 http://127.0.0.1:8080/ >/dev/null 2>&1; then
    HEALTHY=1
    ok "Evolution respondeu (tentativa ${i})"
    break
  fi
  sleep 3
done
if [ "$HEALTHY" -ne 1 ]; then
  warn "Evolution não respondeu em ~90s. Veja: cd ${WORKDIR} && docker compose logs -f evolution-api"
fi

# ---------------------------------------------------------------------------
# i. nginx reverse proxy (idempotente; certbot injeta o TLS depois)
# ---------------------------------------------------------------------------
log "i. nginx reverse proxy"
if [ -f "$NGINX_SITE" ] && [ "$FORCE" -ne 1 ]; then
  ok "preservando ${NGINX_SITE} existente (mantém edições do certbot; use --force p/ recriar)"
else
  # Heredoc QUOTED para não expandir as variáveis do nginx ($host etc.);
  # o domínio entra via placeholder + sed.
  cat > "$NGINX_SITE" <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name __WA_DOMAIN__;

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";
        proxy_read_timeout 120s;
    }
}
NGINX
  sed -i "s/__WA_DOMAIN__/${WA_DOMAIN}/g" "$NGINX_SITE"
  ok "server block escrito para ${WA_DOMAIN}"
fi
ln -sf "$NGINX_SITE" "$NGINX_LINK"
rm -f /etc/nginx/sites-enabled/default
if nginx -t >/dev/null 2>&1; then
  systemctl reload nginx
  ok "nginx recarregado"
else
  warn "nginx -t falhou; revise ${NGINX_SITE}"
  nginx -t || true
fi

# ---------------------------------------------------------------------------
# j. TLS via certbot (idempotente; não reemite se já houver cert válido)
# ---------------------------------------------------------------------------
log "j. Certificado TLS (Let's Encrypt)"
if [ -d "/etc/letsencrypt/live/${WA_DOMAIN}" ]; then
  ok "certificado já existe para ${WA_DOMAIN}; certbot renova via timer (pulando emissão)"
else
  if certbot --nginx -d "${WA_DOMAIN}" --non-interactive --agree-tos \
       -m "${LETSENCRYPT_EMAIL}" --redirect --no-eff-email; then
    ok "certificado emitido e redirect 80→443 configurado"
  else
    warn "certbot falhou (DNS ainda não propagou? porta 80 bloqueada?). Rode depois: certbot --nginx -d ${WA_DOMAIN} --redirect --agree-tos -m ${LETSENCRYPT_EMAIL}"
  fi
fi

# ---------------------------------------------------------------------------
# k. Smoke test interno (HTTPS público, com apikey)
# ---------------------------------------------------------------------------
log "k. Smoke test"
SMOKE_JSON="$(curl -fsS --max-time 15 "https://${WA_DOMAIN}/" -H "apikey: ${AUTHENTICATION_API_KEY}" 2>/dev/null || true)"
if [ -n "$SMOKE_JSON" ]; then
  VERSION="$(echo "$SMOKE_JSON" | grep -oE '"version"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/' || true)"
  ok "HTTPS OK — Evolution version: ${VERSION:-'(não parseada)'}"
  [ "${VERSION:-}" = "${EVOLUTION_VERSION#v}" ] || warn "versão retornada (${VERSION:-?}) difere do alvo ${EVOLUTION_VERSION}"
else
  warn "não obtive resposta HTTPS de https://${WA_DOMAIN}/ (TLS ainda não pronto? tente o smoke local: curl -s http://127.0.0.1:8080/)"
fi

# ---------------------------------------------------------------------------
# RESUMO
# ---------------------------------------------------------------------------
cat <<SUMMARY

==================================================================
  ✅ BOOTSTRAP DO EVOLUTION CONCLUÍDO — ${WA_DOMAIN}
==================================================================

  GUARDE ESTES SEGREDOS num gerenciador de senhas (NÃO vão para o git):

    EVOLUTION_API_URL         = https://${WA_DOMAIN}
    EVOLUTION_API_KEY         = ${AUTHENTICATION_API_KEY}
    EVOLUTION_WEBHOOK_SECRET  = ${WEBHOOK_SECRET}
    (POSTGRES_PASSWORD guardado em ${SECRETS_FILE}, chmod 600)

  PRÓXIMOS PASSOS:

  1) No .env.local do APP Next.js, defina:
       EVOLUTION_API_URL=https://${WA_DOMAIN}
       EVOLUTION_API_KEY=${AUTHENTICATION_API_KEY}
       EVOLUTION_WEBHOOK_SECRET=${WEBHOOK_SECRET}
       NEXT_PUBLIC_APP_URL=<URL pública do app/túnel>   # ex.: https://app.SEUDOMINIO.com.br
     (as três primeiras são server-only — SEM prefixo NEXT_PUBLIC_)

  2) Rode o smoke-test de go-live a partir do repo do app:
       node scripts/whatsapp-golive-check.mjs
     Exija tudo verde (especialmente o passo 3 — persistência do webhook).

  3) No painel: Assistants > Channels > criar canal e parear o QR.
     Depois teste e2e: msg do celular -> inbox; responder -> chega no celular.

  LEMBRETES:
   - Faça BACKUP dos volumes 'postgres_data' e 'evolution_instances'
     (as sessões WhatsApp vivem no segundo — perder = re-parear todos).
     Veja o §8 de docs/deploy/evolution-vps.md.
   - Portas 8080/5432/6379 ficam no loopback; só 22/80/443 abertas (ufw).
   - Re-rodar este script é seguro; --force reescreve os configs SEM trocar segredos.

==================================================================
SUMMARY
