FROM node:22.18.0-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app/services/online
COPY services/online/package.json services/online/package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY services/online/ ./
RUN CALM_ONLINE_DATABASE_URL=file:/data/calendar.db ./node_modules/.bin/prisma generate --schema prisma/schema.prisma
RUN mkdir -p /data && chown -R node:node /app /data
USER node
ENV CALM_ONLINE_HOST=0.0.0.0 CALM_ONLINE_PORT=4242 CALM_ONLINE_DATABASE_URL=file:/data/calendar.db CALM_PROVIDER_VAULT_FILE=/data/provider-vault
EXPOSE 4242
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:4242/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["sh", "/app/services/online/entrypoint.sh"]
CMD ["node", "src/server.mjs"]
