# ===== Desarrollo: TS con hot reload =====
FROM node:20 AS development
WORKDIR /app

COPY server/api/package*.json ./
RUN npm install --include=dev

COPY server/api/ ./

EXPOSE 3000
CMD ["npm", "run", "dev"]

# ===== Build: compilar TS -> JS (dist/) =====
FROM node:20 AS build
WORKDIR /app

COPY server/api/package*.json ./
RUN npm install
COPY server/api/ ./
COPY shared/types/*.d.ts ./src/types/
RUN npm run build:docker

# ===== Producción: solo JS compilado =====
FROM node:22-alpine AS production
WORKDIR /app

COPY server/api/package*.json ./
RUN npm install --omit=dev

# Copiamos solo el JS compilado
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/app.js"]
