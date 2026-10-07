# PostgreSQL 17 + pgBackRest: continuous WAL archiving and base backups to
# S3-compatible storage for point-in-time recovery (docs/deploy/PITR.md).
# Used by the `postgres` and `pitr` services of compose.prod.yml / compose.data.yml.
# Build from the repository root:
#   docker build -f docker/postgres/Dockerfile -t ruangkerja-postgres:test .

# Alpine's pgbackrest package depends on its own PostgreSQL 18 server (16 MB);
# only the binary is copied, linked against this image's libpq 17.
FROM postgres:17-alpine AS pgbackrest
RUN apk add --no-cache pgbackrest

FROM postgres:17-alpine

RUN apk add --no-cache libbz2 libssh2 supercronic \
    && install -d -o postgres -g postgres -m 0750 /var/spool/pgbackrest
COPY --from=pgbackrest /usr/bin/pgbackrest /usr/bin/pgbackrest
COPY --chmod=0755 docker/postgres/pgbackrest-archive /usr/local/bin/pgbackrest-archive
COPY --chmod=0755 scripts/pitr.sh /usr/local/bin/pitr
COPY --chmod=0755 scripts/pitr-restore.sh /usr/local/bin/pitr-restore
COPY --chmod=0755 scripts/wal-check.sh /usr/local/bin/wal-check

# pgBackRest reads every option from PGBACKREST_* variables (no config file).
# Per-server values (endpoint, bucket, keys, cipher passphrase, retention)
# come from compose; these are the fixed defaults.
ENV PGBACKREST_STANZA=ruangkerja \
    PGBACKREST_PG1_PATH=/var/lib/postgresql/data \
    PGBACKREST_PG1_SOCKET_PATH=/var/run/postgresql \
    PGBACKREST_REPO1_TYPE=s3 \
    PGBACKREST_REPO1_PATH=/pgbackrest \
    PGBACKREST_REPO1_S3_URI_STYLE=path \
    PGBACKREST_REPO1_CIPHER_TYPE=aes-256-cbc \
    PGBACKREST_REPO1_BUNDLE=y \
    PGBACKREST_COMPRESS_TYPE=zst \
    PGBACKREST_PROCESS_MAX=2 \
    PGBACKREST_START_FAST=y \
    PGBACKREST_ARCHIVE_ASYNC=y \
    PGBACKREST_SPOOL_PATH=/var/spool/pgbackrest \
    PGBACKREST_LOG_LEVEL_CONSOLE=warn \
    PGBACKREST_LOG_LEVEL_FILE=off

# WAL is always handed to pgbackrest-archive; it only uploads when
# PITR_ENABLED=true (otherwise PostgreSQL recycles the segment as usual).
# archive_timeout forces a segment switch every 60 s on a busy database, so at
# most ~1 minute of committed data is not yet in object storage (RPO).
CMD ["postgres", \
     "-c", "wal_level=replica", \
     "-c", "archive_mode=on", \
     "-c", "archive_command=pgbackrest-archive %p", \
     "-c", "archive_timeout=60"]
