# Etapa de build
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Etapa de produção
FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Se tiver, mantenha. Se não tiver, remova:
# COPY --from=builder /app/public ./public
# COPY --from=builder /app/next.config.js ./next.config.js
# COPY --from=builder /app/tsconfig.json ./tsconfig.json
# COPY --from=builder /app/.env ./.env

EXPOSE 3000
CMD ["npx", "next", "start"]
