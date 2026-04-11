#!/usr/bin/env bash

set -Eeuo pipefail

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/lifetracker}"
BACKEND_DIR="$SOURCE_ROOT/backend"
FRONTEND_DIR="$SOURCE_ROOT/frontend"
APP_DIR="$DEPLOY_ROOT/app"
ENV_FILE="$DEPLOY_ROOT/.env"
PUBLIC_DIR="${PUBLIC_DIR:-/var/www/html}"
BACKEND_SERVICE="${BACKEND_SERVICE:-lifetracker-backend}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3002/api/health}"
RUNTIME_SWITCHED=0

log() {
  printf '\n[%s] %s\n' "$(date '+%F %T')" "$*"
}

fail() {
  printf '\n[deploy] %s\n' "$*" >&2
  exit 1
}

cleanup() {
  rm -rf \
    "$APP_DIR/backend-dist.new" \
    "$APP_DIR/node_modules.new" \
    "$APP_DIR/prisma.new" \
    "$APP_DIR/package.json.new"
}

trap cleanup EXIT

rollback_runtime() {
  if [[ "$RUNTIME_SWITCHED" -ne 1 ]]; then
    return
  fi

  log "rolling back backend runtime payload"
  systemctl stop "$BACKEND_SERVICE" || true

  rm -rf "$APP_DIR/backend-dist" "$APP_DIR/node_modules" "$APP_DIR/prisma" "$APP_DIR/package.json"

  [[ -d "$APP_DIR/backend-dist.previous" ]] && mv "$APP_DIR/backend-dist.previous" "$APP_DIR/backend-dist"
  [[ -d "$APP_DIR/node_modules.previous" ]] && mv "$APP_DIR/node_modules.previous" "$APP_DIR/node_modules"
  [[ -d "$APP_DIR/prisma.previous" ]] && mv "$APP_DIR/prisma.previous" "$APP_DIR/prisma"
  [[ -f "$APP_DIR/package.json.previous" ]] && mv "$APP_DIR/package.json.previous" "$APP_DIR/package.json"

  systemctl start "$BACKEND_SERVICE" || true
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

require_cmd npm
require_cmd node
require_cmd curl
require_cmd systemctl

[[ -f "$ENV_FILE" ]] || fail "missing env file: $ENV_FILE"
[[ -d "$BACKEND_DIR" ]] || fail "missing backend directory: $BACKEND_DIR"
[[ -d "$FRONTEND_DIR" ]] || fail "missing frontend directory: $FRONTEND_DIR"

mkdir -p "$APP_DIR"

log "loading deploy environment from $ENV_FILE"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

[[ -n "${DOMAIN_NAME:-}" ]] || fail "DOMAIN_NAME is not set in $ENV_FILE"
[[ -n "${DATABASE_URL:-}" ]] || fail "DATABASE_URL is not set in $ENV_FILE"

log "installing backend dependencies"
cd "$BACKEND_DIR"
npm ci --include=dev --no-audit --no-fund

log "syncing database schema"
npx prisma db push

log "building backend"
npm run build

log "staging backend runtime files"
cp -a dist "$APP_DIR/backend-dist.new"
cp -a node_modules "$APP_DIR/node_modules.new"
cp -a prisma "$APP_DIR/prisma.new"
cp package.json "$APP_DIR/package.json.new"

log "installing frontend dependencies"
cd "$FRONTEND_DIR"
npm ci --include=dev --no-audit --no-fund

log "building frontend"
NEXT_PUBLIC_API_URL="https://${DOMAIN_NAME}/api" npm run build

log "publishing frontend static files"
mkdir -p "$PUBLIC_DIR"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete out/ "$PUBLIC_DIR/"
else
  find "$PUBLIC_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  cp -a out/. "$PUBLIC_DIR/"
fi

log "switching backend runtime payload"
systemctl stop "$BACKEND_SERVICE" || true
rm -rf "$APP_DIR/backend-dist.previous" "$APP_DIR/node_modules.previous" "$APP_DIR/prisma.previous" "$APP_DIR/package.json.previous"
[[ -d "$APP_DIR/backend-dist" ]] && mv "$APP_DIR/backend-dist" "$APP_DIR/backend-dist.previous"
[[ -d "$APP_DIR/node_modules" ]] && mv "$APP_DIR/node_modules" "$APP_DIR/node_modules.previous"
[[ -d "$APP_DIR/prisma" ]] && mv "$APP_DIR/prisma" "$APP_DIR/prisma.previous"
[[ -f "$APP_DIR/package.json" ]] && mv "$APP_DIR/package.json" "$APP_DIR/package.json.previous"
mv "$APP_DIR/backend-dist.new" "$APP_DIR/backend-dist"
mv "$APP_DIR/node_modules.new" "$APP_DIR/node_modules"
mv "$APP_DIR/prisma.new" "$APP_DIR/prisma"
mv "$APP_DIR/package.json.new" "$APP_DIR/package.json"
RUNTIME_SWITCHED=1
systemctl start "$BACKEND_SERVICE"

log "checking backend service status"
systemctl is-active --quiet "$BACKEND_SERVICE" || {
  rollback_runtime
  journalctl -u "$BACKEND_SERVICE" -n 100 --no-pager || true
  fail "backend service failed to start"
}

log "checking backend health endpoint"
for _ in 1 2 3 4 5; do
  if curl -fsS "$HEALTH_URL" >/dev/null; then
    log "deploy completed successfully"
    exit 0
  fi
  sleep 2
done

rollback_runtime
journalctl -u "$BACKEND_SERVICE" -n 100 --no-pager || true
fail "health check failed: $HEALTH_URL"
