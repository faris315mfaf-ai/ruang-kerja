# Catatan bersama — collab server (Hocuspocus + Yjs), docs/fitur/catatan.md.
# Build from the repository root:  docker build -f collab/Dockerfile collab
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /srv/collab

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

USER node
EXPOSE 1234

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${COLLAB_PORT:-1234}/health" > /dev/null || exit 1

CMD ["node", "src/server.js"]
