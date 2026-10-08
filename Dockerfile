# Panel (Next.js) + worker (Baileys) en un solo contenedor: comparten la base SQLite
# y la sesión de WhatsApp, que viven en el volumen /app/data.

FROM node:20-bookworm-slim AS base
WORKDIR /app
# openssl: lo necesita Prisma. tini: reenvía SIGTERM a los procesos para apagar limpio
RUN apt-get update && apt-get install -y --no-install-recommends openssl tini ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# mkdir public: git no guarda carpetas vacías y el COPY de abajo la necesita
RUN mkdir -p public && npx prisma generate && npx next build
# Quitar dependencias de desarrollo (eslint, tipos...) para la imagen final
RUN npm prune --omit=dev

FROM base AS runner
# socket_timeout: segundos que Prisma espera si SQLite está ocupado (por defecto 5)
# connection_limit=1: cada proceso escribe por una sola conexión, sin pelearse consigo mismo
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/app/data \
    DATABASE_URL="file:/app/data/app.db?socket_timeout=60&connection_limit=1"

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/worker ./worker
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src/lib ./src/lib
COPY --from=build /app/next.config.ts /app/tsconfig.json ./
COPY docker-entrypoint.sh ./

RUN mkdir -p /app/data && chown -R node:node /app/data && chmod +x docker-entrypoint.sh
USER node
VOLUME ["/app/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--", "./docker-entrypoint.sh"]
