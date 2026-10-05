#!/usr/bin/env bash
# Runs ON THE SERVER (piped over SSH by .github/workflows/deploy.yml, or by hand):
#   DEPLOY_PATH=/opt/ruangkerja APP_TAG=<git-sha> bash scripts/deploy-remote.sh
#
# 1. pin APP_TAG in .env  2. pull images  3. start/replace containers and wait
# until healthy  4. migrate  5. restart Horizon workers  6. prune old images.
# Rollback: run again with the previous APP_TAG (printed below and kept in
# .deploy-history); migrations are written to stay backward compatible.
set -euo pipefail

: "${DEPLOY_PATH:?DEPLOY_PATH is required}"
: "${APP_TAG:?APP_TAG is required}"

cd "$DEPLOY_PATH"

# Standard Compose variables, overridable for a staging/smoke stack.
export COMPOSE_FILE=${COMPOSE_FILE:-compose.prod.yml}
export COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-ruangkerja}

compose() { docker compose "$@"; }
log() { echo "[deploy] $(date -u '+%Y-%m-%dT%H:%M:%SZ') $*"; }

[ -f .env ] || { echo "[deploy] .env missing in $DEPLOY_PATH" >&2; exit 1; }

previous=$(grep -E '^APP_TAG=' .env | cut -d= -f2- || true)
log "deploying $APP_TAG (previous: ${previous:-none})"

if grep -qE '^APP_TAG=' .env; then
    sed -i.bak "s/^APP_TAG=.*/APP_TAG=${APP_TAG}/" .env && rm -f .env.bak
else
    echo "APP_TAG=${APP_TAG}" >> .env
fi

if [ "${DEPLOY_PULL:-1}" = "1" ]; then
    log "pulling images"
    compose pull --quiet
fi

log "starting containers"
compose up -d --remove-orphans --wait --wait-timeout 300

log "running migrations"
compose exec -T app php artisan migrate --force

log "syncing roles & permissions"
compose exec -T app php artisan db:seed --force

log "restarting Horizon workers"
compose exec -T queue php artisan horizon:terminate || log "horizon:terminate failed (queue container restarts it anyway)"

echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') ${APP_TAG} (previous ${previous:-none})" >> .deploy-history

log "pruning dangling images"
docker image prune -f > /dev/null

log "done: $(compose ps --format '{{.Service}}={{.Status}}' | tr '\n' ' ')"
