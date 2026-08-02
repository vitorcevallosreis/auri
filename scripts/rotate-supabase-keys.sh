#!/usr/bin/env bash
# Aplica as chaves novas do Supabase depois de regenerar o JWT secret.
#
# A regeneração em si é EXCLUSIVA DO DASHBOARD — a Management API não expõe
# esse endpoint. Este script cuida de tudo o que vem depois.
#
# ------------------------------------------------------------------ como usar
#
# 1. Dashboard -> projeto ffkicwhchrwvavkhfqol -> Project Settings -> API
#    -> JWT Settings -> "Generate new JWT secret".
#
# 2. Copie as DUAS chaves novas (`anon` e `service_role`) para um arquivo,
#    usando um editor de texto — NÃO cole em terminal nem em chat, senão elas
#    ficam registradas no histórico:
#
#      .night-work/new-supabase-keys.env
#        NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
#        SUPABASE_SERVICE_ROLE_KEY=eyJ...
#
# 3. bash scripts/rotate-supabase-keys.sh
#
# O arquivo de entrada é apagado ao final. Nenhum valor de chave é impresso —
# só prefixos mascarados, para conferência.
#
# ------------------------------------------------------------- o que acontece
#
# TODAS AS SESSÕES CAEM. Regenerar o JWT secret invalida os tokens existentes;
# todo mundo que estiver logado precisa entrar de novo. É esperado.
#
# E é REBUILD, não restart: a anon key é build-arg, inlinada no bundle pelo
# deploy-app-vps.sh. Reiniciar o container manteria a chave velha no JavaScript
# servido ao navegador.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE="$(cd "${REPO_ROOT}/.." && pwd)"
INPUT="${BASE}/.night-work/new-supabase-keys.env"
APP_ENV="${BASE}/.night-work/app-deploy.env"
LOCAL_ENV="${REPO_ROOT}/.env.local"
VPS_HOST="${VPS_HOST:-root@80.190.72.243}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mask() { printf '%s…%s' "${1:0:8}" "${1: -6}"; }
die() { printf '\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }
step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

[[ -f "$INPUT" ]] || die "não encontrei ${INPUT}
Crie o arquivo com as duas chaves novas (veja o cabeçalho deste script)."

# shellcheck disable=SC1090
NEW_ANON="$(grep -oE '^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*' "$INPUT" | cut -d= -f2- | tr -d '"'"'"' \r')"
NEW_SERVICE="$(grep -oE '^SUPABASE_SERVICE_ROLE_KEY=.*' "$INPUT" | cut -d= -f2- | tr -d '"'"'"' \r')"

OLD_ANON="$(grep -oE '^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*' "$LOCAL_ENV" | cut -d= -f2-)"
OLD_SERVICE="$(grep -oE '^SUPABASE_SERVICE_ROLE_KEY=.*' "$LOCAL_ENV" | cut -d= -f2-)"
SUPABASE_URL="$(grep -oE '^NEXT_PUBLIC_SUPABASE_URL=.*' "$LOCAL_ENV" | cut -d= -f2-)"

step "Validando as chaves novas"
[[ -n "$NEW_ANON" && -n "$NEW_SERVICE" ]] || die "faltou uma das duas chaves em ${INPUT}"
[[ "$NEW_ANON" == eyJ* && "$NEW_SERVICE" == eyJ* ]] || die "as chaves não parecem JWT (deveriam começar com eyJ)"
[[ "$NEW_ANON" != "$NEW_SERVICE" ]] || die "anon e service_role estão iguais — provável cópia errada"
[[ "$NEW_ANON" != "$OLD_ANON" ]] || die "a anon key é idêntica à atual — o JWT secret não foi regenerado?"
[[ "$NEW_SERVICE" != "$OLD_SERVICE" ]] || die "a service_role é idêntica à atual — o JWT secret não foi regenerado?"

# Prova que as chaves funcionam ANTES de reescrever qualquer arquivo. Aplicar
# uma chave inválida derrubaria o app e o caminho de volta seria manual.
code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 \
  -H "apikey: ${NEW_SERVICE}" -H "Authorization: Bearer ${NEW_SERVICE}" \
  "${SUPABASE_URL}/rest/v1/myia_companies?select=id&limit=1")"
[[ "$code" == "200" ]] || die "a service_role nova respondeu ${code}, não 200 — confira a cópia"
echo "  service_role nova: $(mask "$NEW_SERVICE")  -> 200 OK"
echo "  anon nova .......: $(mask "$NEW_ANON")"

step "Backup dos arquivos de ambiente"
for f in "$APP_ENV" "$LOCAL_ENV"; do
  cp -p "$f" "${f}.bak-${STAMP}"
  chmod 600 "${f}.bak-${STAMP}"
  echo "  ${f}.bak-${STAMP}"
done

step "Reescrevendo as chaves"
NEW_ANON="$NEW_ANON" NEW_SERVICE="$NEW_SERVICE" python3 - "$APP_ENV" "$LOCAL_ENV" <<'PY'
import io, os, sys
repl = {
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": os.environ["NEW_ANON"],
    "SUPABASE_SERVICE_ROLE_KEY":     os.environ["NEW_SERVICE"],
}
for path in sys.argv[1:]:
    lines = io.open(path, encoding="utf-8").readlines()
    out, seen = [], set()
    for line in lines:
        key = line.split("=", 1)[0].strip() if "=" in line else None
        if key in repl:
            out.append("%s=%s\n" % (key, repl[key])); seen.add(key)
        else:
            out.append(line)
    io.open(path, "w", encoding="utf-8").writelines(out)
    print("  %-24s %s" % (os.path.basename(path), ", ".join(sorted(seen)) or "(nada)"))
PY

step "Rebuild e redeploy (a anon key é build-arg — restart não bastaria)"
DEPLOY_WORKER="${DEPLOY_WORKER:-0}" bash "${REPO_ROOT}/scripts/deploy-app-vps.sh"

step "Verificando"
old_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 \
  -H "apikey: ${OLD_SERVICE}" -H "Authorization: Bearer ${OLD_SERVICE}" \
  "${SUPABASE_URL}/rest/v1/myia_companies?select=id&limit=1")"
echo "  service_role ANTIGA -> ${old_code} (esperado 401)"
[[ "$old_code" == "401" ]] || printf '\033[1;31m  ATENÇÃO: a chave antiga ainda responde %s\033[0m\n' "$old_code"

runtime="$(ssh "$VPS_HOST" 'grep -oE "^SUPABASE_SERVICE_ROLE_KEY=.*" /opt/auri-app/.env.runtime | cut -d= -f2-')"
[[ "$runtime" == "$NEW_SERVICE" ]] \
  && echo "  .env.runtime do VPS: chave nova ✓" \
  || die "o .env.runtime do VPS não ficou com a chave nova"

dom="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 https://app.auri.global/login)"
echo "  https://app.auri.global/login -> ${dom}"

step "Limpando"
# O arquivo de entrada carrega as duas chaves em texto puro; não pode sobrar.
if command -v shred >/dev/null 2>&1; then shred -u "$INPUT"; else rm -P "$INPUT" 2>/dev/null || rm -f "$INPUT"; fi
echo "  ${INPUT} apagado"

printf '\n\033[1;32mROTAÇÃO CONCLUÍDA\033[0m\n'
echo "Todas as sessões foram invalidadas — quem estava logado precisa entrar de novo."
echo "Backups em *.bak-${STAMP} (modo 600). Apague-os depois de confirmar que está tudo no ar."
