# ---- Base image with pnpm ----
FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

# ---- Install dependencies ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/api/prisma/ apps/api/prisma/
RUN pnpm install --frozen-lockfile --filter @tmng/saas-api...

# ---- Build / prepare runtime ----
FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY apps/api/ apps/api/
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm --filter @tmng/saas-api exec prisma generate

ENV NODE_ENV=production
EXPOSE 8787

CMD ["pnpm", "--filter", "@tmng/saas-api", "start"]
