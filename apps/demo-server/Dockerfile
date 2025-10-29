# Production Dockerfile for demo-server
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/demo-server/package.json ./apps/demo-server/
COPY apps/demo-server ./apps/demo-server
COPY shared ./shared
COPY types ./types
COPY middleware ./middleware
COPY packages ./packages

RUN pnpm install --no-frozen-lockfile --filter=demo-server && pnpm --filter=demo-server run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
ENV NODE_ENV=production

# Copy workspace files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/demo-server/package.json ./apps/demo-server/
COPY --from=builder /app/apps/demo-server ./apps/demo-server
COPY shared ./shared
COPY types ./types
COPY middleware ./middleware
COPY packages ./packages

RUN pnpm install --no-frozen-lockfile --filter=demo-server --production=false && pnpm store prune

WORKDIR /app/apps/demo-server
EXPOSE 3001

CMD ["pnpm", "run", "start"]