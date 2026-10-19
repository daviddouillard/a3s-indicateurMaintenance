# --- Build du frontend (Vite) ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Image finale : serveur Node (Express) qui sert le frontend + l'API ---
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY server ./server
EXPOSE 8080
CMD ["node", "server/index.mjs"]
