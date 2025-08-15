# ===== Desarrollo: TS con hot reload =====
FROM node:20 AS development
WORKDIR /app

COPY api/package*.json ./
RUN npm install

COPY api/ ./

EXPOSE 3000
CMD ["npm", "run", "dev"]

# ===== Build: compilar TS -> JS (dist/) =====
FROM node:20 AS build
WORKDIR /app

COPY api/package*.json ./
RUN npm install
COPY api/ ./
RUN npm run build

# ===== Producción: solo JS compilado =====
FROM node:20 AS production
WORKDIR /app

COPY api/package*.json ./
RUN npm install --omit=dev

# Copiamos solo el JS compilado
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/app.js"]
