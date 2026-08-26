# ─── Stage 1: Build frontend ──────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=60000

COPY . .
RUN npm run build

# ─── Stage 2: Production server ───────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=60000

COPY --from=builder /app/dist ./dist
COPY server ./server
COPY tsconfig.node.json ./

RUN npm install -g tsx

EXPOSE 3000

CMD ["tsx", "server/index.ts"]
