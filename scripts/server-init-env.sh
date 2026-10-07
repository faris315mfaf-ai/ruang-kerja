#!/usr/bin/env bash
# Creates /opt/ruangkerja/.env from .env.production.example with fresh random
# secrets (docs/deploy/VPS-BERSAMA.md). Run ON THE SERVER as `deploy`:
#
#   scp .env.production.example scripts/server-init-env.sh deploy@<ip>:/opt/ruangkerja/
#   ssh deploy@<ip> 'cd /opt/ruangkerja && bash server-init-env.sh <domain> <ghcr-owner> <acme-email>'
#
# Never prints secrets except REVERB_APP_KEY, which is public (it is baked into
# the JS bundle) and must also be set as the GitHub variable REVERB_APP_KEY.
# Refuses to overwrite an existing .env. Still to fill by hand afterwards:
# SMTP, Google, object storage (AWS_*, BACKUP_*), company name, privacy contact.
# BACKUP_REMOTE starts empty (local dumps only) until object storage exists.
set -euo pipefail

DOMAIN=${1:?usage: server-init-env.sh <domain> <ghcr-owner> <acme-email>}
OWNER=$(printf '%s' "${2:?ghcr owner (GitHub user/org) required}" | tr '[:upper:]' '[:lower:]')
ACME=${3:?acme email required}
TEMPLATE=${TEMPLATE:-.env.production.example}
OUT=${OUT:-.env}

[ -f "$TEMPLATE" ] || { echo "missing $TEMPLATE" >&2; exit 1; }
[ ! -e "$OUT" ] || { echo "$OUT already exists; edit it by hand" >&2; exit 1; }
command -v openssl >/dev/null || { echo "openssl is required" >&2; exit 1; }

hex() { openssl rand -hex "$1"; }
reverb_key=$(hex 16)

umask 077
awk \
    -v domain="$DOMAIN" -v owner="$OWNER" -v acme="$ACME" \
    -v app_key="base64:$(openssl rand -base64 32)" \
    -v db="$(hex 24)" -v redis="$(hex 24)" \
    -v reverb_key="$reverb_key" -v reverb_secret="$(hex 32)" \
    -v qr="$(hex 32)" -v collab="$(hex 32)" '
    /^APP_KEY=/              { print "APP_KEY=" app_key; next }
    /^DB_PASSWORD=/          { print "DB_PASSWORD=" db; next }
    /^REDIS_PASSWORD=/       { print "REDIS_PASSWORD=" redis; next }
    /^REVERB_APP_KEY=/       { print "REVERB_APP_KEY=" reverb_key; next }
    /^VITE_REVERB_APP_KEY=/  { print "VITE_REVERB_APP_KEY=" reverb_key; next }
    /^REVERB_APP_SECRET=/    { print "REVERB_APP_SECRET=" reverb_secret; next }
    /^ATTENDANCE_QR_SECRET=/ { print "ATTENDANCE_QR_SECRET=" qr; next }
    /^ACME_EMAIL=/           { print "ACME_EMAIL=" acme; next }
    /^BACKUP_REMOTE=/        { print "BACKUP_REMOTE="; next }
    /^COLLAB_SECRET=/        { print "COLLAB_SECRET=" collab; next }
    /^COLLAB_IMAGE=/         { print "COLLAB_IMAGE=ghcr.io/" owner "/ruangkerja-collab"; next }
    {
        gsub(/<absensi\.perusahaan\.co\.id>/, domain)
        gsub(/<org>/, owner)
        print
    }' "$TEMPLATE" > "$OUT"
chmod 600 "$OUT"

echo "[init-env] $OUT created for https://${DOMAIN} (images ghcr.io/${OWNER}/ruangkerja)."
echo "[init-env] GitHub variable REVERB_APP_KEY=${reverb_key}"
echo "[init-env] Back up APP_KEY outside this server (password manager): without it NIK, Google tokens and 2FA secrets cannot be decrypted."
echo "[init-env] Remaining <...> placeholders:"
grep -nE '^[A-Z0-9_]+=.*<[^>]*>' "$OUT" | cut -d= -f1 || true
echo "[init-env] BACKUP_REMOTE is empty (dumps stay on this server). Set backup:<bucket>/postgres once object storage is ready."
