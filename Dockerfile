FROM node:22-bookworm-slim AS build

WORKDIR /app

# Forzar entorno de desarrollo en la etapa de build para que npm ci 
# instale las devDependencies necesarias para los tests y la compilación (tsx, typescript, etc.)
ENV NODE_ENV=development

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm test
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       curl postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/database ./database

RUN mkdir -p /app/uploads \
    && chown node:node /app/uploads

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl --fail --silent http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "dist/server.js"]