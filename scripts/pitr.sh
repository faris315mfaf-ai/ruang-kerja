#!/bin/sh
# RuangKerja — pgBackRest base backups for point-in-time recovery (PITR).
# Installed as `pitr` in the ruangkerja-postgres image (docker/postgres/Dockerfile);
# the `pitr` service runs `pitr schedule`. Runbook: docs/deploy/PITR.md.
#
# Usage (docker compose exec pitr pitr <command>):
#   schedule              create the stanza, take a first full backup when the
#                         repository has none, then run the cron schedule below
#   backup [full|diff|incr]   one backup now (default diff; pgBackRest turns it
#                         into a full when no full exists), then expire old ones
#   info                  backups and WAL range in the repository
#   health                container healthcheck: fails after PITR_ALERT_AFTER
#                         consecutive failed wal-check runs
#
# Environment (compose): PITR_ENABLED, PITR_FULL_SCHEDULE, PITR_DIFF_SCHEDULE,
# PITR_CHECK_SCHEDULE, PITR_DEEP_CHECK_SCHEDULE (cron, TZ of the container),
# PITR_ALERT_AFTER, PITR_STATUS_FILE, PGBACKREST_* (repository, retention).
set -eu

PITR_STATUS_FILE=${PITR_STATUS_FILE:-/tmp/pitr-check.status}
PITR_ALERT_AFTER=${PITR_ALERT_AFTER:-2}

log() { echo "[pitr] $(date '+%Y-%m-%dT%H:%M:%S%z') $*"; }
alert() { echo "[pitr] $(date '+%Y-%m-%dT%H:%M:%S%z') ALERT $*" >&2; }
usage() { sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

enabled() { [ "${PITR_ENABLED:-false}" = "true" ]; }

wait_for_postgres() {
    tries=0
    until pg_isready -q -h "${PGBACKREST_PG1_SOCKET_PATH:-/var/run/postgresql}"; do
        tries=$((tries + 1))
        [ "$tries" -lt 150 ] || { alert "PostgreSQL socket not ready after 5 minutes"; return 1; }
        sleep 2
    done
}

# Idempotent: succeeds when the stanza already exists and matches this cluster.
ensure_stanza() {
    pgbackrest --log-level-console=warn stanza-create
}

backup_count() {
    pgbackrest --log-level-console=off info --output=json 2> /dev/null \
        | grep -o '"label":"[^"]*"' | wc -l | tr -d ' '
}

run_backup() {
    type=${1:-diff}
    case "$type" in full | diff | incr) ;; *) echo "unknown backup type: $type" >&2; exit 1 ;; esac
    if ! enabled; then
        log "PITR disabled (PITR_ENABLED=${PITR_ENABLED:-}), skipping $type backup"
        return 0
    fi
    log "$type backup started (stanza ${PGBACKREST_STANZA:-?})"
    if ensure_stanza && pgbackrest --log-level-console=info backup --type="$type"; then
        log "$type backup done"
    else
        alert "$type backup FAILED, see the output above (PITR still works from older backups while WAL archiving runs)"
        return 1
    fi
}

idle() {
    log "PITR disabled (PITR_ENABLED=${PITR_ENABLED:-}): WAL is not archived, no base backups. Set PITR_ENABLED=true and recreate postgres + pitr to start."
    trap 'exit 0' TERM INT
    while :; do
        sleep 3600 &
        wait $! || true
    done
}

schedule() {
    enabled || idle

    : "${PITR_FULL_SCHEDULE:=30 1 * * 0}"
    : "${PITR_DIFF_SCHEDULE:=30 1 * * 1-6}"
    : "${PITR_CHECK_SCHEDULE:=*/10 * * * *}"
    : "${PITR_DEEP_CHECK_SCHEDULE:=15 * * * *}"

    wait_for_postgres
    if ensure_stanza; then
        log "stanza ${PGBACKREST_STANZA} ready in s3://${PGBACKREST_REPO1_S3_BUCKET:-?}${PGBACKREST_REPO1_PATH:-}"
        if [ "$(backup_count)" = "0" ]; then
            log "repository has no backup yet: taking the first full backup now"
            run_backup full || true
        fi
    else
        alert "stanza-create failed (S3 endpoint, bucket, keys or PITR_CIPHER_PASS wrong?); WAL piles up in pg_wal until this is fixed"
    fi

    crontab=/tmp/pitr.crontab
    {
        echo "$PITR_FULL_SCHEDULE pitr backup full"
        echo "$PITR_DIFF_SCHEDULE pitr backup diff"
        echo "$PITR_CHECK_SCHEDULE wal-check"
        echo "$PITR_DEEP_CHECK_SCHEDULE wal-check --deep"
    } > "$crontab"
    log "schedule (${TZ:-UTC}): full '$PITR_FULL_SCHEDULE', diff '$PITR_DIFF_SCHEDULE', check '$PITR_CHECK_SCHEDULE', deep check '$PITR_DEEP_CHECK_SCHEDULE'"
    exec supercronic -passthrough-logs "$crontab"
}

health() {
    [ -f "$PITR_STATUS_FILE" ] || exit 0
    # Status line: "<ok|fail> <consecutive failures> <timestamp> <message>"
    read -r state failures _ < "$PITR_STATUS_FILE" || exit 0
    if [ "$state" = "fail" ] && [ "${failures:-0}" -ge "$PITR_ALERT_AFTER" ]; then
        cat "$PITR_STATUS_FILE"
        exit 1
    fi
    exit 0
}

case "${1:-}" in
    schedule) schedule ;;
    backup) run_backup "${2:-diff}" ;;
    info) pgbackrest --log-level-console=warn info ;;
    health) health ;;
    -h | --help | help) usage 0 ;;
    *) usage 1 ;;
esac
