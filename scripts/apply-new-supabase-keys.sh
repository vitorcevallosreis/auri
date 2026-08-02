#!/usr/bin/env bash
# Aplica as chaves NOVAS do Supabase (sb_publishable_ / sb_secret_).
#
# Caminho recomendado de rotação, e o único obrigatório: as chaves legadas
# (anon / service_role) serão descontinuadas até o fim de 2026.
#
# A vantagem sobre regenerar o JWT secret — que é o que
# scripts/rotate-supabase-keys.sh faz — é que as chaves novas NÃO tocam no JWT
# secret. Os tokens de sessão continuam assinados pelo mesmo segredo, então
# NINGUÉM É DESLOGADO. Regenerar o secret reassina tudo e derruba todas as
# sessões.
#
# ------------------------------------------------------------------ como usar
#
# 1. Dashboard -> projeto -> Project Settings -> API Keys -> aba
#    "Publishable and secret API keys" -> "Create new API keys".
#    As legadas continuam funcionando; nada quebra neste passo.
#
# 2. Copie as duas chaves para um arquivo, com um EDITOR DE TEXTO — não cole em
#    terminal nem em chat, senão ficam no histórico:
#
#      .night-work/new-supabase-keys.env
#        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
#        SUPABASE_SECRET_KEY=sb_secret_...
#
# 3. bash scripts/apply-new-supabase-keys.sh
#
# 4. Depois de conferir que app, worker e seeds funcionam, desative as chaves
#    legadas no dashboard. ESSE é o passo que mata a service_role vazada — e é
#    reversível, dá para reativar se algum chamador tiver escapado.
#
# O arquivo de entrada é apagado ao final. Nenhum valor é impresso — só prefixos.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE="$(cd "${REPO_ROOT}/.." && pwd)"
INPUT="${BASE}/.night-work/new-supabase-keys.env"
APP_ENV="${BASE}/.night-work/app-deploy.env"
LOCAL_ENV="${REPO_ROOT}/.env.local"
VPS_HOST="${VPS_HOST:-root@80.190.72.243}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mask() { printf '%s…%s' "${1:0:20}" "${1: -4}"; }
die() { printf '\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }
step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

[[ -f "$INPUT" ]] || die "não encontrei ${INPUT}
Crie o arquivo com as duas chaves novas (veja o cabeçalho deste script)."

val() { grep -oE "^$1=.*" "$2" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"'"'"' \r'; }

NEW_PUB="$(val NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY "$INPUT")"
NEW_SEC="$(val SUPABASE_SECRET_KEY "$INPUT")"
SUPABASE_URL="$(val NEXT_PUBLIC_SUPABASE_URL "$LOCAL_ENV")"

step "Validando"
[[ -n "$NEW_PUB" && -n "$NEW_SEC" ]] || die "faltou uma das duas chaves em ${INPUT}"
[[ "$NEW_PUB" == sb_publishable_* ]] || die "a publishable não começa com sb_publishable_ — conferir a cópia"
[[ "$NEW_SEC" == sb_secret_* ]]      || die "a secret não começa com sb_secret_ — conferir a cópia"

# Prova as duas chaves ANTES de reescrever arquivo nenhum. As novas vão no
# header `apikey`, NUNCA em `Authorization: Bearer` — essa é a diferença de
# protocolo em relação às legadas, e é onde a migração costuma falhar.
pub_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 \
  -H "apikey: ${NEW_PUB}" "${SUPABASE_URL}/rest/v1/myia_companies?select=id&limit=1")"
sec_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 \
  -H "apikey: ${NEW_SEC}" "${SUPABASE_URL}/rest/v1/myia_companies?select=id&limit=1")"

# A publishable é anônima: o RLS barra tudo, então 200 com lista vazia é o
# esperado. O que importa é NÃO ser 401 (chave inválida).
[[ "$pub_code" != "401" ]] || die "a publishable respondeu 401 — chave inválida"
[[ "$sec_code" == "200" ]] || die "a secret respondeu ${sec_code}, não 200 — conferir a cópia"
echo "  publishable: $(mask "$NEW_PUB")  -> ${pub_code}"
echo "  secret ....: $(mask "$NEW_SEC")  -> ${sec_code} (lê dados, ignora RLS)"

step "Backup"
for f in "$APP_ENV" "$LOCAL_ENV"; do
  cp -p "$f" "${f}.bak-${STAMP}"; chmod 600 "${f}.bak-${STAMP}"
  echo "  ${f}.bak-${STAMP}"
done

step "Gravando as chaves novas AO LADO das legadas"
# As legadas ficam onde estão de propósito: se algo falhar no deploy, o código
# cai de volta nelas sozinho (src/lib/supabase/keys.ts) e nada fica fora do ar.
# Elas saem depois, num segundo passo, quando você desativar no dashboard.
NEW_PUB="$NEW_PUB" NEW_SEC="$NEW_SEC" python3 - "$APP_ENV" "$LOCAL_ENV" <<'PY'
import io, os, sys
novas = {
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": os.environ["NEW_PUB"],
    "SUPABASE_SECRET_KEY":                  os.environ["NEW_SEC"],
}
for path in sys.argv[1:]:
    lines = io.open(path, encoding="utf-8").readlines()
    presentes = {l.split("=", 1)[0].strip() for l in lines if "=" in l}
    out = []
    for line in lines:
        k = line.split("=", 1)[0].strip() if "=" in line else None
        out.append("%s=%s\n" % (k, novas[k]) if k in novas else line)
    faltando = [k for k in novas if k not in presentes]
    if faltando:
        if out and not out[-1].endswith("\n"):
            out.append("\n")
        out.append("\n# Sistema novo de chaves do Supabase. Tem precedencia sobre\n")
        out.append("# NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY.\n")
        out.extend("%s=%s\n" % (k, novas[k]) for k in faltando)
    io.open(path, "w", encoding="utf-8").writelines(out)
    print("  %-24s %s" % (os.path.basename(path), ", ".join(sorted(novas))))
PY

step "Rebuild e redeploy (a chave pública é build-arg — restart não bastaria)"
DEPLOY_WORKER="${DEPLOY_WORKER:-0}" bash "${REPO_ROOT}/scripts/deploy-app-vps.sh"

step "Verificando"
runtime="$(ssh "$VPS_HOST" 'grep -oE "^SUPABASE_SECRET_KEY=.*" /opt/auri-app/.env.runtime | cut -d= -f2-' || true)"
[[ "$runtime" == "$NEW_SEC" ]] \
  && echo "  .env.runtime do VPS com a chave secreta nova ✓" \
  || die "o .env.runtime do VPS não recebeu SUPABASE_SECRET_KEY"

dom="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 https://app.auri.global/login)"
echo "  https://app.auri.global/login -> ${dom}"

step "Limpando"
if command -v shred >/dev/null 2>&1; then shred -u "$INPUT"; else rm -P "$INPUT" 2>/dev/null || rm -f "$INPUT"; fi
echo "  ${INPUT} apagado"

cat <<FIM

$(printf '\033[1;32mCHAVES NOVAS EM USO\033[0m')

Ninguém foi deslogado: o JWT secret não foi tocado.

FALTA O PASSO QUE FECHA O INCIDENTE. As chaves legadas continuam válidas — a
service_role vazada em 31/07 inclusive. Depois de conferir app, worker e seeds:

  Dashboard -> Project Settings -> API Keys -> desativar as chaves legadas

É reversível. Se algum chamador tiver escapado, basta reativar.

Backups em *.bak-${STAMP} (modo 600).
FIM
