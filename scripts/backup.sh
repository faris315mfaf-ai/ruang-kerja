#!/bin/sh
# RuangKerja — PostgreSQL backup (pg_dump custom format) with off-site upload.
#
# Runs daily at 02:00 Asia/Jakarta in the `backup` container (compose.prod.yml),
# or by hand:  docker compose -f compose.prod.yml exec backup backup.sh
#
# Environment:
#   PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE   connection (libpq variables)
#   BACKUP_DIR              local directory for dumps            (default /backups)
#   BACKUP_PREFIX           file name prefix                     (default ruangkerja)
#   BACKUP_REMOTE           rclone destination, e.g. backup:bucket/postgres (empty = local only)
#   BACKUP_RETENTION_DAYS   delete remote dumps older than this  (default 30)
#   BACKUP_LOCAL_KEEP_DAYS  delete local dumps older than this   (default 7)
#   BACKUP_HEARTBEAT_URL    optional URL pinged on success (…/fail on failure), e.g. healthchecks.io
set -eu

: "${PGDATABASE:?PGDATABASE is required}"

BACKUP_DIR=${BACKUP_DIR:-/backups}
BACKUP_PREFIX=${BACKUP_PREFIX:-ruangkerja}
BACKUP_REMOTE=${BACKUP_REMOTE:-}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
BACKUP_LOCAL_KEEP_DAYS=${BACKUP_LOCAL_KEEP_DAYS:-7}
BACKUP_HEARTBEAT_URL=${BACKUP_HEARTBEAT_URL:-}

log() { echo "[backup] $(date '+%Y-%m-%dT%H:%M:%S%z') $*"; }

ping_heartbeat() {
    [ -n "$BACKUP_HEARTBEAT_URL" ] || return 0
    wget -q -T 10 -O /dev/null "$1" || log "warning: heartbeat ping failed"
}

on_exit() {
    status=$?
    rm -f "${partial:-}"
    if [ "$status" -ne 0 ]; then
        log "FAILED (exit $status)"
        ping_heartbeat "${BACKUP_HEARTBEAT_URL%/}/fail"
    fi
}
trap on_exit EXIT

mkdir -p "$BACKUP_DIR"

stamp=$(date '+%Y%m%d-%H%M%S')
file="$BACKUP_DIR/$BACKUP_PREFIX-$stamp.dump"
partial="$file.partial"

log "dumping database '$PGDATABASE' on ${PGHOST:-localhost}:${PGPORT:-5432}"
pg_dump --format=custom --compress=6 --no-owner --no-privileges --file="$partial"

# A dump that pg_restore cannot list is useless: fail before uploading it.
tables=$(pg_restore --list "$partial" | grep -c ' TABLE DATA ' || true)
mv "$partial" "$file"
partial=""

size=$(du -h "$file" | cut -f1)
log "dump ok: $(basename "$file") ($size, $tables tables with data)"

if [ -n "$BACKUP_REMOTE" ]; then
    log "uploading to $BACKUP_REMOTE"
    rclone copy --no-traverse "$file" "$BACKUP_REMOTE/"

    log "remote retention: deleting dumps older than ${BACKUP_RETENTION_DAYS} days"
    rclone delete --min-age "${BACKUP_RETENTION_DAYS}d" --include "$BACKUP_PREFIX-*.dump" "$BACKUP_REMOTE/"
else
    log "BACKUP_REMOTE is empty: keeping the dump locally only"
fi

log "local retention: deleting dumps older than ${BACKUP_LOCAL_KEEP_DAYS} days"
find "$BACKUP_DIR" -maxdepth 1 -name "$BACKUP_PREFIX-*.dump" -mtime "+$BACKUP_LOCAL_KEEP_DAYS" -print -delete

ping_heartbeat "$BACKUP_HEARTBEAT_URL"
log "done"
