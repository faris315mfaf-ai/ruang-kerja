#!/usr/bin/env bash
# Prepares an isolated workspace for one coding agent so Claude Code and Codex
# (or two sessions of either) can work at the same time (AGENTS.md › Kerja
# paralel). Run from any checkout of the repo:
#
#   bash scripts/agen-mulai.sh codex                    # ../ruang-kerja-codex on branch codex/kerja from main
#   bash scripts/agen-mulai.sh codex codex/f2-rapat     # choose the branch (created from main if new)
#   bash scripts/agen-mulai.sh claude --di-sini         # set up the current worktree (e.g. a Claude Code worktree)
#
# Options: --dasar <ref> (base for a new branch, default main), --di-sini,
#          --tanpa-seed (migrate only), --lewati-build.
#
# Per agent it creates/sets:
#   worktree + branch · .env copied from the main checkout (never printed) with
#   APP_URL https://ruangkerja-<agen>.test, DB_DATABASE ruangkerja_<agen>,
#   REDIS_PREFIX/CACHE_PREFIX rk-<agen>-… · .testing-db = ruangkerja_testing_<agen>
#   (read by tests/bootstrap.php) · both databases in the Docker Postgres ·
#   composer install, npm ci, migrate + seed, npm run build · Herd site + HTTPS.
# Idempotent: safe to run again. Undo: scripts/agen-selesai.sh <agen>.
set -euo pipefail

export PATH="$HOME/Library/Application Support/Herd/bin:$PATH"

usage() { sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }

AGENT=""
BRANCH=""
BASE="main"
HERE=0
SEED=1
BUILD=1

while [ $# -gt 0 ]; do
    case "$1" in
        --dasar) BASE=${2:?}; shift 2 ;;
        --di-sini) HERE=1; shift ;;
        --tanpa-seed) SEED=0; shift ;;
        --lewati-build) BUILD=0; shift ;;
        -h|--help) usage ;;
        -*) echo "Opsi tidak dikenal: $1" >&2; usage ;;
        *)
            if [ -z "$AGENT" ]; then AGENT=$1; elif [ -z "$BRANCH" ]; then BRANCH=$1; else usage; fi
            shift ;;
    esac
done

[ -n "$AGENT" ] || usage
[[ "$AGENT" =~ ^[a-z][a-z0-9]{1,15}$ ]] || { echo "Nama agen: huruf kecil/angka, 2–16 karakter (mis. codex, claude, codex2)." >&2; exit 1; }

log() { echo "[agen-mulai:$AGENT] $*"; }

# The main checkout is the first entry of `git worktree list`.
MAIN=$(git worktree list --porcelain | awk '/^worktree /{print substr($0, 10); exit}')
[ -f "$MAIN/.env" ] || { echo "Tidak ada .env di checkout utama ($MAIN). Siapkan dulu (docs/SETUP-LOKAL.md)." >&2; exit 1; }

if [ "$HERE" = 1 ]; then
    DIR=$(git rev-parse --show-toplevel)
    [ "$DIR" != "$MAIN" ] || { echo "--di-sini dipakai di worktree agen, bukan di checkout utama." >&2; exit 1; }
else
    BRANCH=${BRANCH:-$AGENT/kerja}
    DIR=${WORKTREE_DIR:-$(dirname "$MAIN")/ruang-kerja-$AGENT}

    if [ -d "$DIR/.git" ] || [ -f "$DIR/.git" ]; then
        log "worktree sudah ada: $DIR"
    elif git -C "$MAIN" show-ref --verify --quiet "refs/heads/$BRANCH"; then
        log "worktree $DIR untuk branch yang ada $BRANCH"
        git -C "$MAIN" worktree add "$DIR" "$BRANCH"
    else
        log "worktree $DIR, branch baru $BRANCH dari $BASE"
        git -C "$MAIN" worktree add -b "$BRANCH" "$DIR" "$BASE"
    fi
fi

SITE="ruangkerja-$AGENT"
DB="ruangkerja_$AGENT"
TEST_DB="ruangkerja_testing_$AGENT"

# .env: copied, then only these keys are rewritten (values are never printed).
set_env() {
    local key=$1 value=$2 file="$DIR/.env"

    if grep -qE "^${key}=" "$file"; then
        sed -i.bak "s|^${key}=.*|${key}=${value}|" "$file" && rm -f "$file.bak"
    else
        printf '%s=%s\n' "$key" "$value" >> "$file"
    fi
}

if [ ! -f "$DIR/.env" ]; then
    log "menyalin .env dari checkout utama"
    cp "$MAIN/.env" "$DIR/.env"
    chmod 600 "$DIR/.env"
fi

set_env APP_URL "https://$SITE.test"
set_env DB_DATABASE "$DB"
set_env REDIS_PREFIX "rk-$AGENT-database-"
set_env CACHE_PREFIX "rk-$AGENT-cache-"
echo "$TEST_DB" > "$DIR/.testing-db"

# Databases in the shared Docker Postgres (compose project of the main checkout).
log "database $DB dan $TEST_DB"
(cd "$MAIN" && docker compose up -d postgres redis > /dev/null)
for name in "$DB" "$TEST_DB"; do
    (cd "$MAIN" && docker compose exec -T postgres sh -c \
        "psql -U \"\$POSTGRES_USER\" -d postgres -tAc \"SELECT 1 FROM pg_database WHERE datname = '$name'\" | grep -q 1 \
         || psql -U \"\$POSTGRES_USER\" -d postgres -c \"CREATE DATABASE $name OWNER \\\"\$POSTGRES_USER\\\"\"" > /dev/null)
done

cd "$DIR"

log "composer install"
composer install --no-interaction --quiet

log "npm ci"
npm ci --no-audit --no-fund --loglevel=error

php artisan config:clear --quiet
if [ "$SEED" = 1 ]; then
    log "migrate + seed (data demo)"
    php artisan migrate --seed --force --quiet
else
    log "migrate"
    php artisan migrate --force --quiet
fi

if [ "$BUILD" = 1 ]; then
    log "npm run build"
    npm run build > /dev/null
fi

log "situs Herd https://$SITE.test"
herd link "$SITE" > /dev/null
herd secure "$SITE" > /dev/null

cat <<DONE

Siap: agen "$AGENT"
  folder   $DIR
  branch   $(git branch --show-current)
  situs    https://$SITE.test (login demo; sandi password)
  database $DB (dev) · $TEST_DB (composer test)
Langkah berikutnya: buka agen di folder itu, klaim tugas di docs/PEMBAGIAN-TUGAS.md,
catat kemajuan di docs/sesi/$AGENT.md. Jangan menjalankan dev server (Vite/Reverb)
bersamaan dengan agen lain; pakai npm run build.
DONE
