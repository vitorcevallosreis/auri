#!/usr/bin/env bash
# Grava a ANTHROPIC_API_KEY nos dois arquivos de ambiente, sem a chave passar
# pelo terminal visivel nem pelo historico do shell.
#
# POR QUE ESTE SCRIPT EXISTE.
#
# Os dois destinos comecam com ponto (`.env.local` e `.night-work/`), e o
# Finder esconde os dois. Editar a mao significa achar arquivo oculto, e
# colar a chave em chat ou em linha de comando a deixa em transcript e em
# ~/.zsh_history — que foi exatamente como o PAT do Supabase vazou em julho.
#
# `read -rs` nao ecoa e nao entra no historico. A chave e escrita direto nos
# arquivos, e nada aqui imprime o valor: so o prefixo e o tamanho, para voce
# conferir que colou a coisa certa e inteira.
#
# Uso:  bash scripts/set-anthropic-key.sh
#       (rode de dentro de myia_app-develop)

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_ENV="$REPO/.env.local"
DEPLOY_ENV="$(cd "$REPO/.." && pwd)/.night-work/app-deploy.env"

for f in "$LOCAL_ENV" "$DEPLOY_ENV"; do
  [ -f "$f" ] || { echo "FALTA: $f"; exit 2; }
done

printf 'Cole a ANTHROPIC_API_KEY (nao vai aparecer na tela) e de Enter: '
IFS= read -rs CHAVE
printf '\n'

# Espaco e quebra de linha invisiveis vindos do copiar/colar quebram a
# autenticacao com um 401 que nao explica nada. Tira antes de gravar.
CHAVE="$(printf '%s' "$CHAVE" | tr -d '[:space:]')"

[ -n "$CHAVE" ] || { echo "Nada foi colado — nada gravado."; exit 2; }

case "$CHAVE" in
  sk-ant-*) ;;
  *) echo "AVISO: a chave nao comeca com 'sk-ant-'. Confira se copiou a chave da API"
     echo "       (console.anthropic.com), e nao um token de outra coisa."
     printf 'Gravar mesmo assim? [s/N] '
     read -r ok < /dev/tty
     [ "$ok" = "s" ] || { echo "Abortado."; exit 1; } ;;
esac

for f in "$LOCAL_ENV" "$DEPLOY_ENV"; do
  cp "$f" "$f.bak-$(date +%Y%m%d-%H%M%S)"
  # `python3` em vez de `sed -i`: o sed do macOS exige argumento no -i e a
  # chave iria para a linha de comando (logo, para o ps e para o historico).
  ANTHROPIC_KEY_TMP="$CHAVE" ARQ="$f" python3 - <<'PY'
import os, re
arq, chave = os.environ["ARQ"], os.environ["ANTHROPIC_KEY_TMP"]
with open(arq) as fh:
    texto = fh.read()
novo, n = re.subn(r"(?m)^ANTHROPIC_API_KEY=.*$", "ANTHROPIC_API_KEY=" + chave, texto)
if n == 0:
    novo = texto.rstrip("\n") + "\nANTHROPIC_API_KEY=" + chave + "\n"
    n = 1
with open(arq, "w") as fh:
    fh.write(novo)
print(f"  gravado em {arq} ({n} linha)")
PY
  chmod 600 "$f"
done

echo
echo "OK — prefixo ${CHAVE:0:14}… , ${#CHAVE} caracteres."
echo "Permissoes 600 nos dois arquivos. Backups .bak-* ao lado."
echo
echo "Confira que nao ficou vazio (isto NAO mostra a chave):"
echo "  grep -c '^ANTHROPIC_API_KEY=..' .env.local ../.night-work/app-deploy.env"
