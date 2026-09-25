# chart-review

譜面制作のフィードバックを支援する Web アプリケーション。

## 開発環境

- Node.js 24
- pnpm 12.5.1
- Rust stable
- wasm32-unknown-unknown ターゲット
- wasm-pack

依存関係をインストールし、開発サーバーを起動する。

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
pnpm install
pnpm dev
```

`pnpm dev` と `pnpm build` は ChartConverter を使った譜面パーサーを Wasm にビルドする。パーサーの ChartConverter revision は `wasm/chart-parser/Cargo.toml` で固定する。

## コマンド

```sh
pnpm dev                  # 開発サーバーを起動する
pnpm build                # Wasm と Next.js の本番ビルドを実行する
pnpm lint                 # Biome の検査を実行する
pnpm build:chart-parser   # 譜面パーサーを Wasm にビルドする
```
