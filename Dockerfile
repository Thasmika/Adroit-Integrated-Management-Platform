# Adroit Integrated Management Platform: one image serves the API and the web app.
# Build:  docker build -t adroit-platform:1.0.0 .

# ---------- build ----------
FROM node:22-bookworm-slim AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --no-audit --no-fund
COPY packages packages
COPY server server
COPY web web
RUN npm run build -w web && npm run build -w server

# ---------- runtime ----------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 HOST=0.0.0.0 \
    WEB_DIR=/app/web/dist \
    MIGRATIONS_DIR=/app/server/migrations \
    FILES_DIR=/data/files \
    TZ=Asia/Dubai
RUN apt-get update && apt-get install -y --no-install-recommends tini ca-certificates tzdata \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core packages/core
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --omit=dev --no-audit --no-fund -w @adroit/server -w @adroit/core --include-workspace-root \
    && npm cache clean --force
COPY --from=build /src/server/dist server/dist
COPY server/migrations server/migrations
COPY --from=build /src/web/dist web/dist
RUN mkdir -p /data/files && chown -R node:node /data
USER node
WORKDIR /app/server
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/index.mjs"]
