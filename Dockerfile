# syntax=docker/dockerfile:1@sha256:ecfaec9ed6d810b56388c508f4121597bfbba70d41a6dfeee4d8cad5f295fc32

FROM rust:1-bookworm@sha256:93ce27a88655056a51dbdd8f5f2d7ddc071c7b0070fb288a37b5a285fc83971e AS wasm-builder

RUN --mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
	--mount=type=cache,target=/usr/local/cargo/git,sharing=locked \
	rustup target add wasm32-unknown-unknown \
	&& cargo install wasm-pack --locked

WORKDIR /src/wasm/chart-parser
COPY wasm/chart-parser/Cargo.toml wasm/chart-parser/Cargo.lock ./
COPY wasm/chart-parser/src ./src
RUN --mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
	--mount=type=cache,target=/usr/local/cargo/git,sharing=locked \
	--mount=type=cache,target=/src/wasm/chart-parser/target,sharing=locked \
	wasm-pack build --target web --release --out-dir /out

FROM node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS dependencies

RUN apt-get update \
	&& apt-get install --no-install-recommends -y python3 make g++ \
	&& rm -rf /var/lib/apt/lists/* \
	&& corepack enable \
	&& corepack prepare pnpm@12.5.1 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=chart-review-pnpm-store,target=/root/.local/share/pnpm/store,sharing=locked \
	pnpm install --frozen-lockfile

FROM dependencies AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
# The Wasm parser is built in the separate Rust stage before the Next.js build.
COPY --from=wasm-builder /out ./public/wasm/chart-parser
RUN pnpm exec next build

FROM node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS runner

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
