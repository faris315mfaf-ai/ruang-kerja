#!/usr/bin/env bash
# Removes an agent workspace made by scripts/agen-mulai.sh: Herd site and the
# worktree (refused when it has uncommitted changes). The branch is kept.
#
#   bash scripts/agen-selesai.sh codex              # unlink site + remove ../ruang-kerja-codex
#   bash scripts/agen-selesai.sh codex --hapus-db   # also drop ruangkerja_codex, ruangkerja_testing_codex and its _test_N copies
set -euo pipefail

export PATH="$HOME/Library/Application Support/Herd/bin:$PATH"

AGENT=${1:?usage: agen-selesai.sh <agen> [--hapus-db]}
DROP=0
[ "${2:-}" = "--hapus-db" ] && DROP=1
[[ "$AGENT" =~ ^[a-z][a-z0-9]{1,15}$ ]] || { echo "Nama agen tidak valid." >&2; exit 1; }

MAIN=$(git worktree list --porcelain | awk '/^worktree /{print substr($0, 10); exit}')
DIR=${WORKTREE_DIR:-$(dirname "$MAIN")/ruang-kerja-$AGENT}

herd unlink "ruangkerja-$AGENT" > /dev/null 2>&1 || true

if [ -d "$DIR" ]; then
    if [ -n "$(git -C "$DIR" status --porcelain)" ]; then
        echo "Worktree $DIR masih punya perubahan belum di-commit. Commit atau buang dulu." >&2
        exit 1
    fi
    git -C "$MAIN" worktree remove --force "$DIR"   # --force: ignored files (.env, vendor, node_modules)
    echo "[agen-selesai:$AGENT] worktree $DIR dihapus (branch tetap ada)."
fi

if [ "$DROP" = 1 ]; then
    (cd "$MAIN" && docker compose exec -T postgres sh -c \
        "for db in \$(psql -U \"\$POSTGRES_USER\" -d postgres -tAc \"SELECT datname FROM pg_database WHERE datname IN ('ruangkerja_$AGENT', 'ruangkerja_testing_$AGENT') OR datname LIKE 'ruangkerja\\_testing\\_$AGENT\\_test\\_%'\"); do
             psql -U \"\$POSTGRES_USER\" -d postgres -c \"DROP DATABASE \$db WITH (FORCE)\"; done" > /dev/null)
    echo "[agen-selesai:$AGENT] database ruangkerja_$AGENT dan ruangkerja_testing_$AGENT (+ salinan _test_N) dihapus."
fi
