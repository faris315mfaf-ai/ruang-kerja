#!/bin/sh
# RuangKerja — health check for WAL archiving + pgBackRest base backups (PITR).
# Installed as `wal-check` in the ruangkerja-postgres image. The `pitr` service
# runs it every 10 minutes (light) and hourly with --deep; by hand:
#
#   docker compose exec pitr wal-check            # archiver status + newest backup age
#   docker compose exec pitr wal-check --deep     # + `pgbackrest check`: forces a WAL
#                                                 #   switch and waits until it is in S3
#
# Exit 0 = healthy (or PITR disabled), 1 = problem. Every problem is printed as
# "[wal-check] ALERT ..." on stderr (docker compose logs pitr), PITR_HEARTBEAT_URL
# (healthchecks.io / Uptime Kuma push) is pinged on success and <url>/fail on
# failure, and the result is written to PITR_STATUS_FILE for the container
# healthcheck (`pitr health`: unhealthy after PITR_ALERT_AFTER failures in a row).
#
# Environment:
#   PITR_ENABLED               only "true" checks anything
#   PITR_MAX_BACKUP_AGE_HOURS  newest base backup must be younger (default 30)
#   PITR_MAX_READY_WAL         WAL segments waiting for upload before alerting (default 32 = 512 MB)
#   PITR_HEARTBEAT_URL         optional push URL
#   PITR_STATUS_FILE           default /tmp/pitr-check.status
#   PGHOST PGUSER PGDATABASE   libpq connection (the pitr service uses the socket)
set -eu

PITR_MAX_BACKUP_AGE_HOURS=${PITR_MAX_BACKUP_AGE_HOURS:-30}
PITR_MAX_READY_WAL=${PITR_MAX_READY_WAL:-32}
PITR_HEARTBEAT_URL=${PITR_HEARTBEAT_URL:-}
PITR_STATUS_FILE=${PITR_STATUS_FILE:-/tmp/pitr-check.status}

deep=0
case "${1:-}" in
    --deep) deep=1 ;;
    '') ;;
    -h | --help) sed -n '2,26p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
esac

now() { date '+%Y-%m-%dT%H:%M:%S%z'; }
log() { echo "[wal-check] $(now) $*"; }
problems=""
alert() {
    echo "[wal-check] $(now) ALERT $*" >&2
    problems="${problems:+$problems; }$*"
}

ping_heartbeat() {
    [ -n "$PITR_HEARTBEAT_URL" ] || return 0
    wget -q -T 10 -O /dev/null "$1" 2> /dev/null || log "warning: heartbeat ping failed"
}

record() {
    previous=0
    if [ -f "$PITR_STATUS_FILE" ]; then
        read -r state count _ < "$PITR_STATUS_FILE" || true
        [ "${state:-}" = "fail" ] && previous=${count:-0}
    fi
    if [ -z "$problems" ]; then
        echo "ok 0 $(now)" > "$PITR_STATUS_FILE" 2> /dev/null || true
    else
        echo "fail $((previous + 1)) $(now) $problems" > "$PITR_STATUS_FILE" 2> /dev/null || true
    fi
}

if [ "${PITR_ENABLED:-false}" != "true" ]; then
    log "PITR disabled (PITR_ENABLED=${PITR_ENABLED:-}); nothing to check"
    record
    exit 0
fi

sql() { psql -X -A -t -q -v ON_ERROR_STOP=1 "$@"; }

# 1. PostgreSQL side: archiver statistics and the upload backlog -----------
archiver=$(sql -F '|' -c "
    select current_setting('archive_mode'),
           a.archived_count,
           coalesce(a.last_archived_wal, '-'),
           coalesce(to_char(a.last_archived_time, 'YYYY-MM-DD HH24:MI:SSOF'), '-'),
           a.failed_count,
           coalesce(a.last_failed_wal, '-'),
           a.last_failed_time is not null
               and (a.last_archived_time is null or a.last_failed_time > a.last_archived_time),
           (select count(*) from pg_ls_archive_statusdir() s where s.name like '%.ready')
    from pg_stat_archiver a" 2>&1) || { alert "cannot query PostgreSQL: $archiver"; archiver=""; }

if [ -n "$archiver" ]; then
    IFS='|' read -r mode archived last_wal last_time failed failed_wal failing ready <<EOF
$archiver
EOF
    log "archiver: mode=$mode archived=$archived last=$last_wal at $last_time failed=$failed waiting=$ready"
    [ "$mode" = "on" ] || alert "archive_mode is '$mode' (expected on: is the ruangkerja-postgres image running?)"
    [ "$failing" = "f" ] || alert "WAL archiving is failing (last failed segment $failed_wal); see: docker compose logs postgres | grep -i archive"
    [ "$ready" -le "$PITR_MAX_READY_WAL" ] || alert "$ready WAL segments waiting for upload (limit $PITR_MAX_READY_WAL): object storage slow or unreachable, pg_wal is growing"
fi

# 2. Repository side: stanza status and the newest base backup -------------
if info=$(pgbackrest --log-level-console=warn info --output=json 2>&1); then
    # psql parses the JSON (no jq in the image); variables need stdin, not -c.
    summary=$(printf '%s\n' "select
        coalesce(st->'status'->>'code', '?') || '|' ||
        coalesce(st->'status'->>'message', '?') || '|' ||
        (select count(*) from json_array_elements(coalesce(st->'backup', '[]'::json))) || '|' ||
        coalesce((select max((b->'timestamp'->>'stop')::bigint) from json_array_elements(coalesce(st->'backup', '[]'::json)) b)::text, '0') || '|' ||
        extract(epoch from now())::bigint || '|' ||
        coalesce((select string_agg(a->>'max', ',') from json_array_elements(coalesce(st->'archive', '[]'::json)) a), '-') || '|' ||
        coalesce((select string_agg(regexp_replace(r->'status'->>'message', '[|\n]+', ' ', 'g'), ' / ')
                  from json_array_elements(coalesce(st->'repo', '[]'::json)) r
                  where (r->'status'->>'code') <> '0'), '')
        from (select (:'info')::json -> 0 as st) s;" \
        | sql -v info="$info" 2>&1) || { alert "cannot parse pgbackrest info: $summary"; summary=""; }

    if [ -n "$summary" ]; then
        IFS='|' read -r code message backups newest epoch archive_max repo_error <<EOF
$summary
EOF
        age_hours=$(((epoch - newest) / 3600))
        log "repository: status $code ($message), $backups backup(s), newest ${age_hours}h old, newest WAL $archive_max"
        [ "$code" = "0" ] || alert "pgBackRest stanza status $code: $message${repo_error:+ ($repo_error)}"
        if [ "$backups" -eq 0 ]; then
            alert "no base backup in the repository yet (pitr backup full)"
        elif [ "$age_hours" -ge "$PITR_MAX_BACKUP_AGE_HOURS" ]; then
            alert "newest base backup is ${age_hours}h old (limit ${PITR_MAX_BACKUP_AGE_HOURS}h): scheduled backups are failing, see docker compose logs pitr"
        fi
    fi
else
    alert "pgbackrest info failed: $(printf '%s' "$info" | tail -n 3 | tr '\n' ' ')"
fi

# 3. Deep: end-to-end archive test --------------------------------------------
if [ "$deep" -eq 1 ]; then
    if out=$(pgbackrest --log-level-console=warn check 2>&1); then
        log "pgbackrest check ok (a fresh WAL segment reached the repository)"
    else
        alert "pgbackrest check failed: $(printf '%s' "$out" | tail -n 3 | tr '\n' ' ')"
    fi
fi

record
if [ -n "$problems" ]; then
    ping_heartbeat "${PITR_HEARTBEAT_URL%/}/fail"
    exit 1
fi
ping_heartbeat "$PITR_HEARTBEAT_URL"
log "ok"
