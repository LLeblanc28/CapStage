# --- Étape 1 : compilation de l'interface React -----------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/package-lock.json ./client/
RUN npm ci && npm --prefix client ci

COPY . .
RUN npm run build

# --- Étape 2 : image d'exécution --------------------------------------------
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=3001 \
    DATA_DIR=/data
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY --from=build /app/client/dist ./client/dist

# Base SQLite et photos : volume à monter pour conserver les données.
RUN mkdir -p /data && chown -R node:node /data
VOLUME /data
USER node

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1

CMD ["node", "server/src/index.js"]
