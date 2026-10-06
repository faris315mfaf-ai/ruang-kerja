#!/usr/bin/env sh
# Validate the edge config and reload it without downtime. Run on the server
# after adding or changing a file in /opt/edge/sites.
set -eu
docker exec edge-caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec edge-caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
echo "[edge] reloaded"
