#!/bin/sh
# Entrypoint for app, queue, scheduler and reverb containers.
set -eu

cd /app

# storage/ is a shared volume: make sure the expected tree exists.
mkdir -p \
    storage/app/public \
    storage/app/private \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    "${VIEW_COMPILED_PATH:-/tmp/views}"

if [ ! -f .env ] && [ -z "${APP_KEY:-}" ]; then
    echo "entrypoint: /app/.env is missing (mount it, see compose.prod.yml)." >&2
    exit 1
fi

# Cache config, routes, events and views (php artisan optimize).
if [ "${APP_OPTIMIZE:-true}" = "true" ]; then
    php artisan optimize --no-interaction
fi

exec "$@"
