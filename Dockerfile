FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY src ./src
COPY tsconfig.json ./
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY README.md .

EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", "dist/server.js"]
