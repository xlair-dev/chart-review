# syntax=docker/dockerfile:1@sha256:4edf897a3ffa55b89f906fc8cc78afdb3f1834cc9c7083565e611a8a7d5fe99e

FROM --platform=$BUILDPLATFORM rust:1-bookworm@sha256:59037199c44290f2befcdd58dcc540164763fc296950255aaefeef096a1866b0 AS wasm-builder

RUN rustup target add wasm32-unknown-unknown \
	&& cargo install wasm-pack --locked --version 0.15.0

WORKDIR /src/wasm/chart-parser
COPY wasm/chart-parser/Cargo.toml wasm/chart-parser/Cargo.lock ./
RUN mkdir src && touch src/lib.rs
# Keep Cargo dependencies in an exported image layer; GitHub Actions does not persist BuildKit cache mounts by default.
RUN cargo build --locked --target wasm32-unknown-unknown --release --lib
COPY wasm/chart-parser/src ./src
RUN wasm-pack build --target web --release --out-dir /out

FROM node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS dependencies

RUN apt-get update \
	&& apt-get install --no-install-recommends -y python3 make g++ \
	&& rm -rf /var/lib/apt/lists/* \
	&& corepack enable \
	&& corepack prepare pnpm@12.9.1 --activate

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
