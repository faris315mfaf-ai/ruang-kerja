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

[ -f .env ] || { echo "[deploy] .env missing in $DEPLOY_PATH" >&2; exit 1; }

# Standard Compose variables, overridable for a staging/smoke stack. On a VPS
# shared with other projects .env sets COMPOSE_FILE=compose.prod.yml:compose.shared.yml
# (docs/deploy/VPS-BERSAMA.md).
env_compose_file=$(grep -E '^COMPOSE_FILE=' .env | cut -d= -f2- | tr -d '"' || true)
export COMPOSE_FILE=${COMPOSE_FILE:-${env_compose_file:-compose.prod.yml}}
export COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-ruangkerja}
EDGE_PATH=${EDGE_PATH:-/opt/edge}

compose() { docker compose "$@"; }
log() { echo "[deploy] $(date -u '+%Y-%m-%dT%H:%M:%SZ') $*"; }

shared=0
case "$COMPOSE_FILE" in *compose.shared.yml*) shared=1 ;; esac
if [ "$shared" = 1 ]; then
    docker network inspect edge > /dev/null 2>&1 \
        || { echo "[deploy] Docker network 'edge' missing: run scripts/server-bootstrap.sh first" >&2; exit 1; }
    [ -f docker/caddy/site.caddy.template ] \
        || { echo "[deploy] docker/caddy/site.caddy.template missing in $DEPLOY_PATH" >&2; exit 1; }
fi

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

if [ "$shared" = 1 ]; then
    domain=$(grep -E '^APP_DOMAIN=' .env | cut -d= -f2- | tr -d '"')
    site="$EDGE_PATH/sites/ruangkerja.caddy"
    log "publishing $domain on the shared edge proxy ($site)"
    [ -f "$site" ] && cp "$site" "$site.prev"
    sed "s/__APP_DOMAIN__/${domain}/g" docker/caddy/site.caddy.template > "$site"
    # Landing page at "/" (same as the standalone Caddyfile): static files next to
    # the site file, inside the sites/ folder edge-caddy already mounts.
    landing="$EDGE_PATH/sites/ruangkerja-landing"
    rm -rf "$landing.new" "$landing.prev"
    cp -R docker/caddy/landing "$landing.new"
    if [ -d "$landing" ]; then mv "$landing" "$landing.prev"; fi
    mv "$landing.new" "$landing"
    if docker exec edge-caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile > /dev/null 2>&1; then
        docker exec edge-caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
        rm -f "$site.prev"
        rm -rf "$landing.prev"
    else
        echo "[deploy] edge config invalid, restoring the previous site file" >&2
        if [ -f "$site.prev" ]; then mv "$site.prev" "$site"; else rm -f "$site"; fi
        rm -rf "$landing"
        if [ -d "$landing.prev" ]; then mv "$landing.prev" "$landing"; fi
        exit 1
    fi
fi

# Two-server split (docs/deploy/DUA-VPS.md): the web VPS has `app` (runs the
# migrations), the data VPS has `queue`. Deploy the data VPS first.
services=$(compose config --services)
has_service() { printf '%s\n' "$services" | grep -qx "$1"; }

if has_service app; then
    log "running migrations"
    compose exec -T app php artisan migrate --force

    log "syncing roles & permissions"
    compose exec -T app php artisan db:seed --force
fi

if has_service queue; then
    log "restarting Horizon workers"
    compose exec -T queue php artisan horizon:terminate || log "horizon:terminate failed (queue container restarts it anyway)"
fi

echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') ${APP_TAG} (previous ${previous:-none})" >> .deploy-history

log "pruning dangling images"
docker image prune -f > /dev/null

log "done: $(compose ps --format '{{.Service}}={{.Status}}' | tr '\n' ' ')"
