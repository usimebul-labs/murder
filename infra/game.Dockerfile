# 게임 서버 이미지. 저장소 루트에서 빌드:
#   docker build -f infra/game.Dockerfile -t murder-game .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@mm/game...
RUN pnpm deploy --filter=@mm/game --prod --legacy /out

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out .
EXPOSE 2567
CMD ["node", "dist/index.js"]
