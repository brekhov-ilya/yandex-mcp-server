# syntax=docker/dockerfile:1

# ---------- Stage 1: builder ----------
# Собирает TypeScript-исходники в dist/ с dev-зависимостями (typescript, @types/node).
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------- Stage 2: runtime ----------
# Только production-зависимости и скомпилированный dist/ — минимальный образ.
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Продакшен-зависимости проекта минимальны: @modelcontextprotocol/sdk и zod.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Непривилегированный пользователь вместо root.
RUN addgroup -S mcp && adduser -S mcp -G mcp
USER mcp

EXPOSE 3000

# У сервера нет отдельного health-эндпоинта. GET /mcp без заголовка Authorization
# всегда отвечает мгновенно (без сетевых вызовов к Яндексу) кодом 401 в формате
# JSON-RPC — это надёжный сигнал, что HTTP-сервер поднят и обрабатывает запросы.
# Любой ответ со статусом < 500 считается здоровым состоянием контейнера.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get({host:'127.0.0.1',port:3000,path:'/mcp'}, res => process.exit(res.statusCode && res.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/index.js", "--transport", "http", "--host", "0.0.0.0"]
