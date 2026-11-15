# Self-hosted Pass the World: website + API + SQLite + save files in one container.
FROM node:24-slim AS build
WORKDIR /src
RUN npm install -g pnpm@11.28.4
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json api/
COPY site/package.json site/
RUN pnpm install --frozen-lockfile
COPY api api
COPY site site
RUN pnpm --filter site build && pnpm --filter api build:node

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data \
    SITE_DIR=/app/site \
    MIGRATIONS_DIR=/app/migrations
COPY --from=build /src/api/dist/server.mjs ./server.mjs
COPY --from=build /src/api/migrations ./migrations
COPY --from=build /src/site/dist ./site
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:8080/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "server.mjs"]
