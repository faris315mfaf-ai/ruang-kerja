#!/bin/sh
# RuangKerja — point-in-time restore with pgBackRest (docs/deploy/PITR.md).
# Installed as `pitr-restore` in the ruangkerja-postgres image. Runs with
# PostgreSQL STOPPED, inside a one-off container of the postgres service:
#
#   docker compose stop app queue scheduler reverb pitr postgres
#   docker compose run --rm --no-deps postgres pitr-restore --time "2026-10-07 10:15:00+07"
#   docker compose up -d postgres      # replays WAL up to the target, then promotes
#
# Usage:
#   pitr-restore (--time "YYYY-MM-DD HH:MM:SS+07" | --latest) [--set LABEL] [--delta --yes]
#   pitr-restore --list
#
#   --time T     stop replay just before the first transaction committed after T
#                (include the offset: +07 = WIB; PostgreSQL otherwise assumes UTC)
#   --latest     replay every archived WAL segment (newest state the archive has)
#   --set LABEL  restore from this backup set (pitr-restore --list); default:
#                the newest backup taken before T
#   --delta      reuse the existing data directory (only changed files are
#                downloaded); required when it is not empty, together with --yes
#   --yes        confirm overwriting a non-empty data directory
#   --list       show backups and the WAL range that can be restored
set -eu

PGDATA=${PGDATA:-/var/lib/postgresql/data}

log() { echo "[pitr-restore] $*"; }
fail() { echo "[pitr-restore] ERROR: $*" >&2; exit 1; }
usage() { sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

# `docker compose run` starts as root: hand the data directory to postgres and
# continue as postgres so restored files get the right owner.
if [ "$(id -u)" = "0" ]; then
    mkdir -p "$PGDATA"
    chown postgres:postgres "$PGDATA"
    chmod 0700 "$PGDATA"
    exec gosu postgres "$0" "$@"
fi

mode=""
target=""
set_label=""
delta=0
yes=0

while [ $# -gt 0 ]; do
    case "$1" in
        --time) mode='time'; target=${2:?--time needs a timestamp}; shift ;;
        --latest) mode='latest' ;;
        --set) set_label=${2:?--set needs a backup label}; shift ;;
        --delta) delta=1 ;;
        --yes) yes=1 ;;
        --list) exec pgbackrest --log-level-console=warn info ;;
        -h | --help) usage 0 ;;
        *) echo "Unknown option: $1" >&2; usage 1 ;;
    esac
    shift
done

[ -n "$mode" ] || usage 1

[ ! -f "$PGDATA/postmaster.pid" ] \
    || fail "$PGDATA/postmaster.pid exists: stop PostgreSQL first (docker compose stop postgres)"

if [ -n "$(ls -A "$PGDATA" 2> /dev/null)" ]; then
    [ "$delta" -eq 1 ] && [ "$yes" -eq 1 ] \
        || fail "$PGDATA is not empty: pass --delta --yes to overwrite it (the current database is replaced)"
fi

set -- --log-level-console=info restore
[ "$delta" -eq 1 ] && set -- "$@" --delta
[ -n "$set_label" ] && set -- "$@" --set="$set_label"

case "$mode" in
    time)
        log "restoring stanza ${PGBACKREST_STANZA:-?} to $target into $PGDATA"
        set -- "$@" --type=time --target="$target" --target-action=promote
        ;;
    latest)
        log "restoring stanza ${PGBACKREST_STANZA:-?} to the end of the WAL archive into $PGDATA"
        set -- "$@" --type=default
        ;;
esac

pgbackrest "$@"

log "files restored. Next: start PostgreSQL (docker compose up -d postgres). It replays WAL from"
log "the repository up to the target, promotes, and starts a new timeline. Follow with"
log "  docker compose logs -f postgres     ('database system is ready to accept connections')"
log "then verify the data, start the other services and take a full backup (pitr backup full)."
