# Fly.io / 汎用 Docker 用（Node 18）
FROM node:18-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .

# Fly.io が PORT を注入する。未設定時は 3000
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
