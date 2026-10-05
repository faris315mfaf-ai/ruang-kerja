# syntax=docker/dockerfile:1.7
#
# Production image for RuangKerja (one image for app, queue, scheduler, reverb).
#
# Runtime: FrankenPHP (classic mode) on Debian. It serves HTTP and static files
# on :8000 by itself, so no nginx/php-fpm pair or shared public/ volume is
# needed behind the Caddy edge (docs/ARCHITECTURE.md §6). Debian rather than
# Alpine: FrankenPHP uses ZTS PHP threads, which are slower on musl.
#
#   docker build -t ruangkerja:test \
#     --build-arg APP_VERSION=$(git rev-parse --short HEAD) \
#     --build-arg VITE_REVERB_HOST=ruangkerja.example.com .

ARG PHP_IMAGE=dunglas/frankenphp:1-php8.4-bookworm
ARG NODE_IMAGE=node:22-bookworm-slim
ARG COMPOSER_IMAGE=composer:2

FROM ${COMPOSER_IMAGE} AS composer
FROM ${NODE_IMAGE} AS node

# ---------------------------------------------------------------------------
# base: PHP runtime + extensions (shared by build and runtime stages)
# ---------------------------------------------------------------------------
FROM ${PHP_IMAGE} AS base

RUN set -eux; \
    install-php-extensions pdo_pgsql pgsql intl gd zip pcntl redis opcache bcmath exif; \
    apt-get update; \
    apt-get install -y --no-install-recommends curl; \
    rm -rf /var/lib/apt/lists/*; \
    cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

COPY docker/app/php.ini "$PHP_INI_DIR/conf.d/zz-ruangkerja.ini"

WORKDIR /app

# ---------------------------------------------------------------------------
# vendor: production Composer dependencies + application source
# ---------------------------------------------------------------------------
FROM base AS vendor

COPY --from=composer /usr/bin/composer /usr/bin/composer
ENV COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1

COPY composer.json composer.lock ./
RUN composer install --no-dev --prefer-dist --no-progress --no-scripts --no-autoloader

COPY . .
RUN set -eux; \
    mkdir -p bootstrap/cache storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs; \
    composer dump-autoload --no-dev --optimize --classmap-authoritative

# ---------------------------------------------------------------------------
# node_modules: npm dependencies (cached separately from the source)
# ---------------------------------------------------------------------------
FROM node AS node_modules

WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
# assets: Vite build. Needs PHP because the Wayfinder plugin runs
# `php artisan wayfinder:generate`. VITE_* values are baked into the bundle.
# ---------------------------------------------------------------------------
FROM vendor AS assets

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx
COPY --from=node_modules /app/node_modules ./node_modules

ARG VITE_APP_NAME=RuangKerja
ARG VITE_REVERB_APP_KEY=""
ARG VITE_REVERB_HOST=""
ARG VITE_REVERB_PORT=443
ARG VITE_REVERB_SCHEME=https
ENV VITE_APP_NAME=${VITE_APP_NAME} \
    VITE_REVERB_APP_KEY=${VITE_REVERB_APP_KEY} \
    VITE_REVERB_HOST=${VITE_REVERB_HOST} \
    VITE_REVERB_PORT=${VITE_REVERB_PORT} \
    VITE_REVERB_SCHEME=${VITE_REVERB_SCHEME}

RUN npm run build

# ---------------------------------------------------------------------------
# runtime
# ---------------------------------------------------------------------------
FROM base AS runtime

ARG APP_VERSION=dev
ARG UID=1000
ARG GID=1000

# Real environment variables win over /app/.env (Dotenv never overrides them).
# Compiled Blade views stay inside each container, not in the shared storage volume.
ENV APP_ENV=production \
    APP_DEBUG=false \
    APP_VERSION=${APP_VERSION} \
    LOG_CHANNEL=stderr \
    LOG_STDERR_FORMATTER=Monolog\\Formatter\\JsonFormatter \
    VIEW_COMPILED_PATH=/tmp/views

LABEL org.opencontainers.image.title="RuangKerja" \
      org.opencontainers.image.revision="${APP_VERSION}"

RUN set -eux; \
    groupadd --gid "${GID}" app; \
    useradd --uid "${UID}" --gid app --no-create-home --home-dir /app --shell /usr/sbin/nologin app; \
    mkdir -p /data/caddy /config/caddy /tmp/views; \
    chown -R app:app /data/caddy /config/caddy /tmp/views

COPY docker/app/Caddyfile /etc/frankenphp/Caddyfile
COPY --chmod=0755 docker/app/entrypoint.sh /usr/local/bin/entrypoint

# Code is owned by root (read-only for the app user); only storage/ and
# bootstrap/cache are writable.
COPY --from=vendor /app /app
COPY --from=assets /app/public/build /app/public/build

RUN set -eux; \
    rm -f public/hot; \
    ln -sfn ../storage/app/public public/storage; \
    chown -R app:app storage bootstrap/cache

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/up > /dev/null || exit 1

ENTRYPOINT ["entrypoint"]
CMD ["frankenphp", "run", "--config", "/etc/frankenphp/Caddyfile"]
