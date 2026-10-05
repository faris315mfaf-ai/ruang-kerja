#!/bin/sh
# `schedule` (default): run backup.sh on BACKUP_SCHEDULE (cron syntax, TZ=Asia/Jakarta).
# Anything else is executed as-is, e.g. `backup.sh` or `restore.sh --latest ...`.
set -eu

if [ "${1:-schedule}" = "schedule" ]; then
    crontab=/tmp/backup.crontab
    echo "${BACKUP_SCHEDULE} /usr/local/bin/backup.sh" > "$crontab"
    echo "[backup] schedule '${BACKUP_SCHEDULE}' (${TZ:-UTC}), remote: ${BACKUP_REMOTE:-<local only>}"
    exec supercronic -passthrough-logs "$crontab"
fi

exec "$@"
