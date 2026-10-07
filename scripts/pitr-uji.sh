#!/usr/bin/env bash
# RuangKerja — local end-to-end drill: WAL archiving + point-in-time restore.
#
#   bash scripts/pitr-uji.sh [--keep]
#
# Docker only. Builds docker/postgres/Dockerfile as ruangkerja-postgres:pitr-uji,
# starts the REAL `postgres` + `pitr` services of compose.prod.yml under the
# throwaway project `rkwaltest` (override docker/pitr-uji/compose.yml) with a
# SeaweedFS S3 behind a self-signed certificate, random throwaway keys and the
# same restricted bucket identity as production. No host ports, no remote
# servers, the dev stack (`ruangkerja`) is never touched.
#
#   1. first full backup (pitr service on start)    5. note T, then batch C + delete half of A
#   2. table pitr_uji + batch A (100 rows)          6. wal-check --deep (WAL reaches S3)
#   3. differential backup                          7. pitr-restore --time T into postgres-restore
#   4. batch B (100 rows)                           8. row set == row set at T
#   9. the restored copy wrote nothing to the repository
#  10. S3 down → wal-check ALERT + `pitr health` unhealthy; S3 back → ok
#  11. side copy with `docker run` + pitr-restore --latest == current database
#  12. in-place restore of the live database to T (--delta), new timeline archives,
#      full backup + wal-check --deep ok → PASS
#
# Everything (containers, volumes incl. the S3 data, image, temp folder) is
# removed at the end; --keep leaves the stack running for inspection
# (tear down later with the command printed at the end).
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
PROJECT=${PITR_UJI_PROJECT:-rkwaltest}
TAG=pitr-uji
keep=0
[ "${1:-}" = "--keep" ] && keep=1

case "$PROJECT" in
    ruangkerja | ruangkerja-*) echo "refusing to use project name '$PROJECT' (dev/prod stack)" >&2; exit 1 ;;
esac
for bin in docker openssl; do
    command -v "$bin" > /dev/null || { echo "$bin is required" >&2; exit 1; }
done

work=$(mktemp -d "${TMPDIR:-/tmp}/pitr-uji.XXXXXX")
export PITR_UJI_DIR=$work

log() { printf '\n[pitr-uji] %s\n' "$*"; }
fail() { printf '\n[pitr-uji] FAIL: %s\n' "$*" >&2; exit 1; }

compose() {
    docker compose -p "$PROJECT" --project-directory "$ROOT" --env-file "$work/env" \
        -f "$ROOT/compose.prod.yml" -f "$ROOT/docker/pitr-uji/compose.yml" --profile restore "$@"
}

cleanup() {
    status=$?
    if [ "$keep" -eq 1 ]; then
        echo "[pitr-uji] --keep: stack left running. Tear down with:"
        echo "  PITR_UJI_DIR=$work docker compose -p $PROJECT --project-directory $ROOT --env-file $work/env -f $ROOT/compose.prod.yml -f $ROOT/docker/pitr-uji/compose.yml --profile restore down -v && rm -rf $work && docker image rm ruangkerja-postgres:$TAG"
        exit "$status"
    fi
    if [ "$status" -ne 0 ] && [ -f "$work/env" ]; then
        echo "[pitr-uji] logs (last 40 lines per service):" >&2
        compose logs --no-color --tail 40 postgres pitr postgres-restore >&2 2> /dev/null || true
    fi
    echo "[pitr-uji] tearing down project $PROJECT (containers + volumes)"
    docker rm -f "${PROJECT}-pulih" > /dev/null 2>&1 || true
    [ -f "$work/env" ] && compose down -v --remove-orphans > /dev/null 2>&1 || true
    docker volume rm "${PROJECT}_pulih" > /dev/null 2>&1 || true
    docker image rm "ruangkerja-postgres:$TAG" > /dev/null 2>&1 || true
    rm -rf "$work"
    exit "$status"
}
trap cleanup EXIT

# --- 0. Throwaway configuration ------------------------------------------------
log "temp folder $work"
mkdir -p "$work/tls"
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=seaweedfs" \
    -addext "subjectAltName=DNS:seaweedfs" \
    -keyout "$work/tls/s3.key" -out "$work/tls/s3.crt" 2> /dev/null
chmod 0644 "$work/tls/s3.key" "$work/tls/s3.crt"

s3_key=$(openssl rand -hex 16)
s3_secret=$(openssl rand -hex 32)
cat > "$work/s3.json" << JSON
{"identities": [{"name": "ruangkerja-backup",
  "credentials": [{"accessKey": "$s3_key", "secretKey": "$s3_secret"}],
  "actions": ["Read:ruangkerja-backup", "Write:ruangkerja-backup", "List:ruangkerja-backup"]}]}
JSON

cat > "$work/env" << ENV
APP_IMAGE=ruangkerja-unused
BACKUP_IMAGE=ruangkerja-unused
APP_DOMAIN=localhost
ACME_EMAIL=pitr-uji@example.test
REDIS_PASSWORD=$(openssl rand -hex 12)
DB_DATABASE=ruangkerja
DB_USERNAME=ruangkerja
DB_PASSWORD=$(openssl rand -hex 12)
POSTGRES_IMAGE=ruangkerja-postgres
POSTGRES_TAG=$TAG
PITR_ENABLED=true
PITR_S3_ENDPOINT=seaweedfs
PITR_S3_BUCKET=ruangkerja-backup
BACKUP_S3_ACCESS_KEY_ID=$s3_key
BACKUP_S3_SECRET_ACCESS_KEY=$s3_secret
PITR_CIPHER_PASS=$(openssl rand -base64 48 | tr -d '\n')
ENV

pg() { compose exec -T postgres psql -U ruangkerja -d ruangkerja -XAtq -v ON_ERROR_STOP=1 "$@"; }
pg_restored() { compose exec -T postgres-restore psql -U ruangkerja -d ruangkerja -XAtq -v ON_ERROR_STOP=1 "$@"; }
rowset="select count(*) || ' rows, md5 ' || coalesce(md5(string_agg(id || ':' || label, ',' order by id)), '-') from pitr_uji"

# --- 1. Image, S3, PostgreSQL + pitr -------------------------------------------
log "building ruangkerja-postgres:$TAG (docker/postgres/Dockerfile)"
docker build -q -f "$ROOT/docker/postgres/Dockerfile" -t "ruangkerja-postgres:$TAG" "$ROOT" > /dev/null

log "starting SeaweedFS S3 (HTTPS, self-signed) and creating bucket ruangkerja-backup"
compose up -d --wait seaweedfs
for _ in $(seq 1 30); do
    if echo "s3.bucket.create -name ruangkerja-backup" | compose exec -T seaweedfs weed shell > /dev/null 2>&1 \
        && echo "s3.bucket.list" | compose exec -T seaweedfs weed shell 2> /dev/null | grep -q ruangkerja-backup; then
        break
    fi
    sleep 2
done
echo "s3.bucket.list" | compose exec -T seaweedfs weed shell 2> /dev/null | grep -q ruangkerja-backup \
    || fail "bucket not created"

log "starting postgres (archive_mode=on, archive_timeout=60) + pitr sidecar"
compose up -d --wait postgres pitr
pg -c "select 'wal_level=' || current_setting('wal_level') || ' archive_mode=' || current_setting('archive_mode') || ' archive_command=' || current_setting('archive_command') || ' archive_timeout=' || current_setting('archive_timeout')"

log "1. waiting for the first full backup taken by the pitr sidecar"
for _ in $(seq 1 90); do
    compose exec -T pitr pgbackrest info --output=json 2> /dev/null | grep -q '"label"' && break
    sleep 2
done
compose exec -T pitr pgbackrest info --output=json 2> /dev/null | grep -q '"label"' || fail "no first backup after 3 minutes"
compose logs --no-color pitr | grep '\[pitr\]' | sed 's/^/    /'

# --- 2-5. Data, backups, target time --------------------------------------------
log "2. table pitr_uji + batch A (100 rows)"
pg -c "create table pitr_uji (id int primary key, label text not null, created_at timestamptz not null default clock_timestamp())"
pg -c "insert into pitr_uji (id, label) select g, 'A' || g from generate_series(1, 100) g"

log "3. differential backup (pitr backup diff)"
compose exec -T pitr pitr backup diff | grep -E '\[pitr\]|backup command end|new backup label' | sed 's/^/    /'

log "4. batch B (100 rows)"
pg -c "insert into pitr_uji (id, label) select g, 'B' || g from generate_series(101, 200) g"
sleep 2
target=$(pg -c "select to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') || '+00'")
expected=$(pg -c "$rowset")
log "5. target time T = $target  (row set at T: $expected)"
sleep 2
pg -c "insert into pitr_uji (id, label) select g, 'C' || g from generate_series(201, 300) g"
pg -c "delete from pitr_uji where id <= 50"
after=$(pg -c "$rowset")
echo "    after T (batch C + 50 rows of A deleted, the 'accident'): $after"

# --- 6. WAL in object storage ------------------------------------------------------
log "6. wal-check --deep (forces a WAL switch, waits until it is in S3)"
compose exec -T pitr wal-check --deep 2>&1 | sed 's/^/    /'
# The async push may already be in S3 while PostgreSQL still marks the segment .ready.
for _ in $(seq 1 30); do
    pending=$(pg -c "select count(*) from pg_ls_archive_statusdir() where name like '%.ready'")
    [ "$pending" = "0" ] && break
    sleep 1
done
[ "$pending" = "0" ] || fail "$pending WAL segments still waiting for upload"
compose exec -T pitr pitr info | sed 's/^/    /'

# --- 7. Restore to T into a fresh instance ------------------------------------------
log "7. pitr-restore --time '$target' into a new volume (postgres-restore)"
compose run --rm --no-deps -T postgres-restore pitr-restore --time "$target" 2>&1 \
    | grep -E 'pitr-restore|restore command (begin|end)|restore backup set|write updated' | sed 's/^/    /'
compose up -d --no-deps postgres-restore

promoted=""
for _ in $(seq 1 90); do
    promoted=$(pg_restored -c "select not pg_is_in_recovery()" 2> /dev/null || true)
    [ "$promoted" = "t" ] && break
    sleep 2
done
[ "$promoted" = "t" ] || fail "restored instance did not finish recovery"
compose logs --no-color postgres-restore | grep -E 'starting point-in-time recovery|recovery stopping|selected new timeline|archive recovery complete|ready to accept' | sed 's/^/    /'

# --- 8. Compare ----------------------------------------------------------------------
got=$(pg_restored -c "$rowset")
c_rows=$(pg_restored -c "select count(*) from pitr_uji where label like 'C%'")
a_rows=$(pg_restored -c "select count(*) from pitr_uji where id <= 50")
log "8. compare"
echo "    expected (original at T): $expected"
echo "    restored (new instance) : $got"
echo "    batch C rows restored   : $c_rows (expected 0)"
echo "    deleted A rows back     : $a_rows (expected 50)"
[ "$got" = "$expected" ] || fail "restored row set differs from the row set at T"
[ "$c_rows" = "0" ] || fail "rows written after T were restored"
[ "$a_rows" = "50" ] || fail "rows deleted after T are missing"

# --- 9. The restored copy (PITR_ENABLED=false) wrote nothing into the repository ---
sleep 3
timeline2=$(compose exec -T pitr pgbackrest repo-ls --recurse archive 2> /dev/null | grep -cE '(^|/)00000002(\.history|[0-9A-F]{16})' || true)
log "9. timeline-2 files from the restored copy in the repository: $timeline2 (expected 0)"
[ "$timeline2" = "0" ] || fail "the restored copy archived into the production repository"

# --- 10. Alerting: object storage down → wal-check fails, container unhealthy -------
log "10. alert path: stop S3, run wal-check twice, expect ALERT + unhealthy; start S3, expect ok"
compose stop seaweedfs > /dev/null 2>&1
for run in 1 2; do
    if compose exec -T pitr wal-check > "$work/check.log" 2>&1; then
        fail "wal-check passed while S3 is down"
    fi
    grep -m1 ALERT "$work/check.log" | sed "s/^/    run $run: /"
done
compose exec -T pitr pitr health > /dev/null 2>&1 && fail "pitr health still healthy after 2 failed checks"
echo "    pitr health: unhealthy (docker compose ps shows the pitr container as unhealthy)"
compose start seaweedfs > /dev/null 2>&1
recovered=0
for _ in $(seq 1 30); do
    if compose exec -T pitr wal-check > "$work/check.log" 2>&1; then
        recovered=1
        break
    fi
    sleep 2
done
[ "$recovered" -eq 1 ] || { cat "$work/check.log" >&2; fail "wal-check did not recover after S3 came back"; }
compose exec -T pitr pitr health > /dev/null 2>&1 || fail "pitr health still unhealthy after a good check"
echo "    S3 back: wal-check ok, pitr health ok"

# --- 11. Side copy with plain `docker run` (PITR.md §5c), replay to the end ----------
log "11. side copy (docs/deploy/PITR.md §5c): docker run + pitr-restore --latest"
compose exec -T pitr wal-check --deep > /dev/null 2>&1 || fail "wal-check --deep failed before the side copy"
latest=$(pg -c "$rowset")
compose exec -T pitr env | grep '^PGBACKREST_' > "$work/pitr.env"
image="ruangkerja-postgres:$TAG"
side=(--network "${PROJECT}_default" --env-file "$work/pitr.env" -e PITR_ENABLED=false -v "$work/tls:/tls:ro" -v "${PROJECT}_pulih:/var/lib/postgresql/data")
docker run --rm "${side[@]}" "$image" pitr-restore --latest 2>&1 | grep -E 'restore backup set|restore command end' | sed 's/^/    /'
docker run -d --name "${PROJECT}-pulih" "${side[@]}" -e POSTGRES_PASSWORD=unused "$image" > /dev/null
side_rows=""
for _ in $(seq 1 90); do
    side_rows=$(docker exec "${PROJECT}-pulih" psql -U ruangkerja -d ruangkerja -XAtq -c "select case when pg_is_in_recovery() then 'recovering' else ($rowset) end" 2> /dev/null || true)
    case "$side_rows" in *rows*) break ;; esac
    sleep 2
done
echo "    original now : $latest"
echo "    side copy    : $side_rows"
[ "$side_rows" = "$latest" ] || fail "side copy (--latest) differs from the current database"

# --- 12. In-place restore of the live database (PITR.md §5b) -------------------------
log "12. in-place restore (docs/deploy/PITR.md §5b): stop, pitr-restore --time T --delta --yes, start"
compose stop pitr postgres > /dev/null 2>&1
compose run --rm --no-deps -T postgres pitr-restore --time "$target" --delta --yes 2>&1 \
    | grep -E 'restore backup set|restore command end' | sed 's/^/    /'
compose up -d --wait postgres pitr > /dev/null 2>&1
promoted=""
for _ in $(seq 1 90); do
    promoted=$(pg -c "select not pg_is_in_recovery()" 2> /dev/null || true)
    [ "$promoted" = "t" ] && break
    sleep 2
done
[ "$promoted" = "t" ] || fail "live database did not finish recovery"
live=$(pg -c "$rowset")
echo "    live database now: $live (expected $expected)"
[ "$live" = "$expected" ] || fail "in-place restore differs from the row set at T"
compose exec -T pitr pitr backup full 2>&1 | grep -E 'new backup label|\[pitr\]' | sed 's/^/    /'
compose exec -T pitr wal-check --deep 2>&1 | grep -E 'repository|check ok|ALERT' | sed 's/^/    /'
compose exec -T pitr wal-check --deep > /dev/null 2>&1 || fail "wal-check --deep failed on the new timeline"

log "PASS: point-in-time restore to $target reproduced the exact row set ($got)"
