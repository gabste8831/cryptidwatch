#!/usr/bin/env bash
# Cria o moderador inicial no banco da AWS (SEC-15: não existe rota para virar moderador).
# A senha é digitada sem eco e vai só para o processo dentro do pod: não fica no histórico
# do shell, em arquivo nem em manifest.
#   scripts/seed-moderator.sh moderador@exemplo.com
set -euo pipefail

EMAIL="${1:?uso: $0 <email-do-moderador>}"
read -r -s -p "Senha do moderador (mínimo 10 caracteres): " PASS
echo

# shellcheck disable=SC2016 # aspas simples de propósito: as variáveis expandem dentro do pod
printf '%s' "$PASS" | kubectl -n cryptidwatch exec -i deploy/api -- \
  sh -c 'read -r P; SEED_MODERATOR_EMAIL="$1" SEED_MODERATOR_PASSWORD="$P" node src/scripts/seed.js' _ "$EMAIL"
