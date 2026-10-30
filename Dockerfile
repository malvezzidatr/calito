# syntax=docker/dockerfile:1

# Compila a aplicação
FROM node:22-alpine AS build
WORKDIR /app

RUN apk add --no-cache git openssl python3 make g++

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

COPY . .
RUN yarn build

# Instala as dependências de produção
FROM node:22-alpine AS prod-deps
WORKDIR /app

RUN apk add --no-cache git openssl python3 make g++

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

# Imagem final
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl
RUN addgroup -S calito && adduser -S calito -G calito

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/prisma ./prisma
COPY --from=build /app/dist ./dist
COPY package.json prisma.config.ts ./

USER calito

EXPOSE 3000
CMD ["node", "dist/main"]