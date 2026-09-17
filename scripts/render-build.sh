#!/bin/sh
# Build do ronin-web como Static Site no Render (Linux). Guia: docs/ops/deploy-render.md.
#
# O @raphasparda/ronin-shared vem de `link:../ronin-api/packages/shared`, então o build clona o
# Ronin-End (privado) ao lado deste repositório antes de instalar e buildar o web. Saída: dist/.
#
# Variáveis:
#   GH_RONIN_END_TOKEN  fine-grained PAT com "Contents: Read-only" no Ronin-End (obrigatória,
#                       exceto quando RONIN_API_GIT_URL é definida)
#   RONIN_API_REF       branch ou tag do Ronin-End (padrão: main)
#   RONIN_API_GIT_URL   URL alternativa do repositório, sem token (só para testar localmente)
#
# Nunca ligar `set -x`: o token faz parte da URL do clone.
set -eu

log() {
  printf '==> %s\n' "$*"
}

fail() {
  printf 'ERRO: %s\n' "$*" >&2
  exit 1
}

WEB_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
API_DIR="$(dirname -- "$WEB_DIR")/ronin-api"
API_REF=${RONIN_API_REF:-main}
TOKEN=${GH_RONIN_END_TOKEN:-}

if [ -n "${RONIN_API_GIT_URL:-}" ]; then
  API_URL=$RONIN_API_GIT_URL
  TOKEN=''
elif [ -z "$TOKEN" ]; then
  fail 'GH_RONIN_END_TOKEN não definida. Cadastre no Render (Environment) um fine-grained PAT com "Contents: Read-only" no repositório raphasparda/Ronin-End.'
else
  API_URL="https://x-access-token:${TOKEN}@github.com/raphasparda/Ronin-End.git"
fi
PUBLIC_API_URL='https://github.com/raphasparda/Ronin-End.git'

# O Render reaproveita a pasta do projeto entre builds, então a cópia do ronin-api pode já
# existir. Se for um clone válido, atualiza; qualquer outra coisa no caminho é erro.
REUSE_CLONE=no
if [ -e "$API_DIR" ]; then
  if [ -d "$API_DIR/.git" ] && [ -f "$API_DIR/packages/shared/package.json" ]; then
    REUSE_CLONE=yes
  elif [ "${RENDER:-}" = true ]; then
    # No Render a pasta do projeto sobrevive entre builds: um clone interrompido vira lixo.
    log "Removendo cópia incompleta em $API_DIR"
    rm -rf "$API_DIR"
  else
    fail "$API_DIR já existe e não é um clone do ronin-api. Remova a pasta antes do build."
  fi
fi

# Esconde o token em qualquer saída do git (mensagens de erro podem repetir a URL).
redact() {
  if [ -z "$TOKEN" ]; then
    cat
    return
  fi
  awk -v secret="$TOKEN" '{
    while ((i = index($0, secret)) > 0) $0 = substr($0, 1, i - 1) "***" substr($0, i + length(secret))
    print
  }'
}

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT
trap 'exit 130' INT TERM

clone_status=0
if [ "$REUSE_CLONE" = yes ]; then
  log "Atualizando ronin-api existente (ref: $API_REF) em $API_DIR"
  {
    GIT_TERMINAL_PROMPT=0 git -C "$API_DIR" fetch --quiet --depth 1 -- "$API_URL" "$API_REF" &&
      git -C "$API_DIR" reset --hard --quiet FETCH_HEAD &&
      git -C "$API_DIR" clean -fdq
  } >"$TMP_DIR/clone.log" 2>&1 || clone_status=$?
else
  log "Clonando ronin-api (ref: $API_REF) em $API_DIR"
  GIT_TERMINAL_PROMPT=0 git clone --quiet --depth 1 --branch "$API_REF" -- "$API_URL" "$API_DIR" \
    >"$TMP_DIR/clone.log" 2>&1 || clone_status=$?
fi
redact <"$TMP_DIR/clone.log"
if [ "$clone_status" -ne 0 ]; then
  fail "não consegui obter o ronin-api (código $clone_status). Confira GH_RONIN_END_TOKEN (validade e acesso ao Ronin-End) e RONIN_API_REF."
fi
if [ -z "${RONIN_API_GIT_URL:-}" ]; then
  git -C "$API_DIR" remote set-url origin "$PUBLIC_API_URL"
fi
log "ronin-api em $(git -C "$API_DIR" rev-parse --short HEAD)"

log 'Habilitando pnpm via corepack (versão do packageManager)'
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
mkdir -p "$TMP_DIR/bin"
corepack enable --install-directory "$TMP_DIR/bin" pnpm
PATH="$TMP_DIR/bin:$PATH"
export PATH
log "pnpm $(pnpm --version)"

# Só o pacote de contratos e as dependências de produção dele (zod): nada da API nem do banco.
# NODE_ENV fica só nos installs: um NODE_ENV=development no build geraria bundle de dev.
log 'Instalando dependências do @raphasparda/ronin-shared (ronin-api)'
(cd "$API_DIR" && NODE_ENV=production pnpm install --frozen-lockfile --prod \
  --filter @raphasparda/ronin-shared)

log 'Instalando dependências do ronin-web'
(cd "$WEB_DIR" && NODE_ENV=development pnpm install --frozen-lockfile)

log 'Build do ronin-web'
(cd "$WEB_DIR" && pnpm build)

[ -f "$WEB_DIR/dist/index.html" ] || fail 'dist/index.html não foi gerado.'
log "Build pronto em $WEB_DIR/dist"
