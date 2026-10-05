# Backup sidecar: pg_dump 17 + rclone (S3-compatible upload) + supercronic.
# Build from the repository root:
#   docker build -f docker/backup/Dockerfile -t ruangkerja-backup:test .
FROM postgres:17-alpine

RUN apk add --no-cache rclone supercronic tzdata ca-certificates

COPY --chmod=0755 scripts/backup.sh /usr/local/bin/backup.sh
COPY --chmod=0755 scripts/restore.sh /usr/local/bin/restore.sh
COPY --chmod=0755 docker/backup/entrypoint.sh /usr/local/bin/backup-entrypoint

# rclone remotes come from RCLONE_CONFIG_<NAME>_* variables; the empty config
# file only silences the "config file not found" notice.
ENV TZ=Asia/Jakarta \
    BACKUP_SCHEDULE="0 2 * * *" \
    BACKUP_DIR=/backups \
    RCLONE_CONFIG=/etc/rclone/rclone.conf

RUN mkdir -p /backups /etc/rclone \
    && touch /etc/rclone/rclone.conf \
    && chown postgres:postgres /backups

USER postgres
WORKDIR /backups
VOLUME ["/backups"]

ENTRYPOINT ["backup-entrypoint"]
CMD ["schedule"]
