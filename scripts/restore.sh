#!/bin/sh
# RuangKerja — restore a pg_dump (custom format) and verify it.
#
# Usage:
#   restore.sh (--latest | --remote NAME | --file PATH) [--target DB] [--create]
#              [--compare DB] [--drop-after] [--yes]
#
#   --latest        newest dump in BACKUP_REMOTE (or in BACKUP_DIR when BACKUP_REMOTE is empty)
#   --remote NAME   download NAME (e.g. ruangkerja-20261005-020000.dump) from BACKUP_REMOTE
#   --file PATH     restore a local dump file
#   --target DB     database to restore into (default: $PGDATABASE)
#   --create        create the target database when it does not exist
#   --compare DB    compare exact row counts per table with another database on the same server
#   --drop-after    drop the target database after a successful verification (restore drill)
#   --yes           required to overwrite $PGDATABASE (the live database)
#
# Examples:
#   Monthly drill (production host, scratch DB, live DB untouched):
#     docker compose -f compose.prod.yml exec backup \
#       restore.sh --latest --target ruangkerja_restore_test --create --compare ruangkerja --drop-after
#   Disaster recovery (stop app, queue, scheduler, reverb first):
#     docker compose -f compose.prod.yml exec backup restore.sh --latest --yes
#
# Uses the libpq variables PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE and the
# BACKUP_DIR / BACKUP_REMOTE / BACKUP_PREFIX variables of backup.sh.
set -eu

BACKUP_DIR=${BACKUP_DIR:-/backups}
BACKUP_PREFIX=${BACKUP_PREFIX:-ruangkerja}
BACKUP_REMOTE=${BACKUP_REMOTE:-}

source_mode=""
source_value=""
target=${PGDATABASE:-}
create=0
compare=""
drop_after=0
yes=0

log() { echo "[restore] $*"; }
fail() { echo "[restore] ERROR: $*" >&2; exit 1; }
usage() { sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

while [ $# -gt 0 ]; do
    case "$1" in
        --latest) source_mode='latest' ;;
        --remote) source_mode='remote'; source_value=${2:?--remote needs a file name}; shift ;;
        --file) source_mode='file'; source_value=${2:?--file needs a path}; shift ;;
        --target) target=${2:?--target needs a database name}; shift ;;
        --create) create=1 ;;
        --compare) compare=${2:?--compare needs a database name}; shift ;;
        --drop-after) drop_after=1 ;;
        --yes) yes=1 ;;
        -h|--help) usage 0 ;;
        *) echo "Unknown option: $1" >&2; usage 1 ;;
    esac
    shift
done

[ -n "$source_mode" ] || usage 1
[ -n "$target" ] || fail "no target database (--target or PGDATABASE)"

case "$target" in
    *[!A-Za-z0-9_]*) fail "target database name may only contain letters, digits and _" ;;
esac

if [ "$target" = "${PGDATABASE:-}" ] && [ "$yes" -ne 1 ]; then
    fail "refusing to overwrite the live database '$target' without --yes"
fi

if [ "$drop_after" -eq 1 ] && [ "$target" = "${PGDATABASE:-}" ]; then
    fail "--drop-after cannot be used on the live database"
fi

workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT

# 1. Locate the dump --------------------------------------------------------
case "$source_mode" in
    file)
        dump=$source_value
        ;;
    remote)
        [ -n "$BACKUP_REMOTE" ] || fail "BACKUP_REMOTE is empty"
        log "downloading $source_value from $BACKUP_REMOTE"
        rclone copyto "$BACKUP_REMOTE/$source_value" "$workdir/$source_value"
        dump="$workdir/$source_value"
        ;;
    latest)
        if [ -n "$BACKUP_REMOTE" ]; then
            name=$(rclone lsf --files-only --include "$BACKUP_PREFIX-*.dump" "$BACKUP_REMOTE/" | sort | tail -n 1)
            [ -n "$name" ] || fail "no dumps found in $BACKUP_REMOTE"
            log "latest remote dump: $name"
            rclone copyto "$BACKUP_REMOTE/$name" "$workdir/$name"
            dump="$workdir/$name"
        else
            dump=$(find "$BACKUP_DIR" -maxdepth 1 -name "$BACKUP_PREFIX-*.dump" | sort | tail -n 1)
            [ -n "$dump" ] || fail "no dumps found in $BACKUP_DIR"
            log "latest local dump: $dump"
        fi
        ;;
esac

[ -f "$dump" ] || fail "dump not found: $dump"

# 2. Check the archive ------------------------------------------------------
pg_restore --list "$dump" > "$workdir/toc.txt" || fail "not a valid pg_dump archive: $dump"
expected_tables=$(grep -c ' TABLE public ' "$workdir/toc.txt" || true)
log "archive ok: $expected_tables tables in schema public"

# 3. Prepare the target database ------------------------------------------
exists=$(psql -d postgres -Atc "select 1 from pg_database where datname = '$target'")
if [ "$exists" != "1" ]; then
    [ "$create" -eq 1 ] || fail "database '$target' does not exist (use --create)"
    log "creating database $target"
    createdb "$target"
fi

# 4. Restore ----------------------------------------------------------------
log "restoring into $target"
pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error --dbname="$target" "$dump"

# 5. Verify -----------------------------------------------------------------
restored_tables=$(psql -d "$target" -Atc "select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'")
log "tables restored: $restored_tables / $expected_tables"
[ "$restored_tables" -eq "$expected_tables" ] || fail "table count mismatch"

migrations=$(psql -d "$target" -Atc "select count(*) from migrations" 2>/dev/null || echo "?")
users=$(psql -d "$target" -Atc "select count(*) from users" 2>/dev/null || echo "?")
log "rows: migrations=$migrations users=$users"

if [ -n "$compare" ]; then
    log "comparing exact row counts with database '$compare'"
    mismatches=0
    for table in $(psql -d "$target" -Atc "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1"); do
        a=$(psql -d "$target" -Atc "select count(*) from public.\"$table\"")
        b=$(psql -d "$compare" -Atc "select count(*) from public.\"$table\"" 2>/dev/null || echo "missing")
        if [ "$a" != "$b" ]; then
            log "  DIFF $table: restored=$a $compare=$b"
            mismatches=$((mismatches + 1))
        fi
    done
    if [ "$mismatches" -eq 0 ]; then
        log "row counts identical for all $restored_tables tables"
    else
        log "$mismatches table(s) differ (expected for tables written after the dump was taken)"
    fi
fi

if [ "$drop_after" -eq 1 ]; then
    log "dropping $target"
    dropdb "$target"
fi

log "restore verified"
