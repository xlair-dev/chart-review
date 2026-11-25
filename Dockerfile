# syntax=docker/dockerfile:1@sha256:572cebbc2b15e6f84c077742952674889cb63cd5e9b80abdffcbe587b6f19183

FROM node:24-bookworm-slim@sha256:873f586f3794f52281bd039bf02c048a0be08fde619338f9941bad1eb6b34530 AS dependencies

RUN apt-get update \
	&& apt-get install --no-install-recommends -y python3 make g++ \
	&& rm -rf /var/lib/apt/lists/* \
	&& corepack enable \
	&& corepack prepare pnpm@12.11.2 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=chart-review-pnpm-store,target=/root/.local/share/pnpm/store,sharing=locked \
	pnpm install --frozen-lockfile

FROM dependencies AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN pnpm exec next build

FROM node:24-bookworm-slim@sha256:873f586f3794f52281bd039bf02c048a0be08fde619338f9941bad1eb6b34530 AS runner

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV CHART_REVIEW_DATA_DIR=/app/data
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
RUN mkdir /app/data && chown node:node /app/data

USER node

EXPOSE 3000
VOLUME ["/app/data"]

CMD ["node", "server.js"]
