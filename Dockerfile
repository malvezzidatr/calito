# syntax=docker/dockerfile:1

# ---- Stage 1: build ----
# Instala TODAS as deps (incl. dev), gera o client do Prisma e compila o Nest.
FROM node:22-alpine AS build
WORKDIR /app

# git: uma dep transitiva do Baileys (libsignal-node) é instalada via git.
# openssl: o schema engine do Prisma precisa dele no Alpine.
# python3/make/g++: build de módulos nativos (node-gyp) dessa mesma dep.
RUN apk add --no-cache git openssl python3 make g++

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

COPY . .
RUN yarn build

# ---- Stage 2: dependencies de produção ----
# Reinstala só as deps de produção, num diretório separado, pra não
# levar devDependencies pra imagem final.
FROM node:22-alpine AS prod-deps
WORKDIR /app

RUN apk add --no-cache git openssl python3 make g++

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

# ---- Stage 3: runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl

# Usuário não-root
RUN addgroup -S calito && adduser -S calito -G calito

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/prisma ./prisma
COPY --from=build /app/dist ./dist
COPY package.json prisma.config.ts ./

USER calito

EXPOSE 3000

# Aplica migrations pendentes antes de subir o processo. O `exec` faz o node
# virar PID 1 e receber o SIGTERM da plataforma (shutdown gracioso do Nest).
# Se preferirem rodar migration como step separado do deploy, tirar o
# "./node_modules/.bin/prisma migrate deploy &&" daqui.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node dist/main"]
