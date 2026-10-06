#!/usr/bin/env bash
# One-time setup of a VPS SHARED with other projects (docs/deploy/VPS-BERSAMA.md).
# Run as root from a directory that contains this script and deploy/edge:
#
#   scp -r scripts/server-bootstrap.sh deploy/edge root@<ip>:/root/rk-setup/
#   ssh root@<ip> 'bash /root/rk-setup/server-bootstrap.sh it@perusahaan.co.id [deploy-pubkey-file]'
#
# Idempotent: safe to run again. It
#   1. creates the `deploy` user (docker group, SSH keys of root + optional key)
#   2. sets the clock to UTC and enables the firewall (SSH, 80, 443 tcp/udp)
#   3. creates the shared Docker network `edge` and starts the edge proxy in /opt/edge
#   4. prepares /opt/ruangkerja for the deploy workflow
# Docker Engine + compose plugin must already be installed (`curl -fsSL https://get.docker.com | sh`).
set -euo pipefail

ACME_EMAIL=${1:?usage: server-bootstrap.sh <acme-email> [deploy-pubkey-file]}
DEPLOY_PUBKEY_FILE=${2:-}
HERE=$(cd "$(dirname "$0")" && pwd)
EDGE_SRC=${EDGE_SRC:-$HERE/edge}
EDGE_PATH=${EDGE_PATH:-/opt/edge}
APP_PATH=${APP_PATH:-/opt/ruangkerja}

log() { echo "[bootstrap] $*"; }

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
command -v docker >/dev/null || { echo "Docker is not installed" >&2; exit 1; }
[ -f "$EDGE_SRC/compose.yml" ] || { echo "missing $EDGE_SRC/compose.yml (copy deploy/edge next to this script)" >&2; exit 1; }

# 1. deploy user -------------------------------------------------------------
if ! id deploy >/dev/null 2>&1; then
    log "creating user deploy"
    adduser --disabled-password --gecos "" deploy
fi
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
for keys in /root/.ssh/authorized_keys ${DEPLOY_PUBKEY_FILE:+"$DEPLOY_PUBKEY_FILE"}; do
    [ -f "$keys" ] || continue
    while IFS= read -r key; do
        [ -n "$key" ] && ! grep -qxF "$key" /home/deploy/.ssh/authorized_keys && echo "$key" >> /home/deploy/.ssh/authorized_keys
    done < "$keys"
done
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

# 2. clock & firewall --------------------------------------------------------
timedatectl set-timezone UTC || true
if command -v ufw >/dev/null; then
    log "firewall: SSH, 80/tcp, 443/tcp, 443/udp"
    ufw allow OpenSSH >/dev/null
    ufw allow 80/tcp >/dev/null
    ufw allow 443/tcp >/dev/null
    ufw allow 443/udp >/dev/null
    ufw --force enable >/dev/null
fi
# Docker publishes ports with its own iptables rules (bypassing ufw). Only the
# edge proxy publishes ports; project databases stay on private networks.

# 3. shared edge proxy -------------------------------------------------------
docker network inspect edge >/dev/null 2>&1 || { log "creating network edge"; docker network create edge >/dev/null; }

install -d -m 755 "$EDGE_PATH"
install -d -m 2775 -o root -g deploy "$EDGE_PATH/sites"
cp "$EDGE_SRC/compose.yml" "$EDGE_SRC/Caddyfile" "$EDGE_SRC/reload.sh" "$EDGE_PATH/"
cp -n "$EDGE_SRC/sites/README.caddy" "$EDGE_PATH/sites/" 2>/dev/null || true
chmod 755 "$EDGE_PATH/reload.sh"
if grep -qE '^ACME_EMAIL=' "$EDGE_PATH/.env" 2>/dev/null; then
    sed -i "s|^ACME_EMAIL=.*|ACME_EMAIL=${ACME_EMAIL}|" "$EDGE_PATH/.env"
else
    echo "ACME_EMAIL=${ACME_EMAIL}" >> "$EDGE_PATH/.env"
fi
chmod 640 "$EDGE_PATH/.env"
log "starting edge proxy"
(cd "$EDGE_PATH" && docker compose up -d --wait --wait-timeout 120)

# 4. project directory -------------------------------------------------------
install -d -m 750 -o deploy -g deploy "$APP_PATH" "$APP_PATH/docker/caddy"

log "done. Next: as deploy, put .env.production.example in $APP_PATH and run scripts/server-init-env.sh"
