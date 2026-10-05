# chart-review

譜面制作のフィードバックを支援する Web アプリケーション。

## 開発環境

- Node.js 24
- pnpm 12.9.1
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

FB 会機能では `.env.local` に `CHART_REVIEW_SERVER_URL`、`AUTH0_DOMAIN`、`AUTH0_AUDIENCE`、`AUTH0_CLIENT_ID`、`AUTH0_CLIENT_SECRET` を設定する。Client ID と Client Secret には Auth0 の `XLAIR Web` M2M Application の値を使う（Deploy CLI や `XLAIR Device` の credentials ではない）。Chart Review は client credentials grant で `device` 権限を持つ access token を取得し、期限前に更新する。Client Secret と access token はサーバー側だけで扱い、ブラウザーへ返さない。譜面ファイルの上限は `CHART_REVIEW_MAX_UPLOAD_SIZE_BYTES` でバイト単位に設定し、既定値は 50 MiB (52,428,800 bytes) とする。C2S、SUS、UGC を受け付ける。SQLite とアップロード譜面は `CHART_REVIEW_DATA_DIR` (既定値 `./data`) に保存する。本番環境では、このディレクトリを永続ボリュームに割り当てる。

## コマンド

```sh
pnpm dev                  # 開発サーバーを起動する
pnpm build                # Wasm と Next.js の本番ビルドを実行する
pnpm lint                 # Biome の検査を実行する
pnpm build:chart-parser   # 譜面パーサーを Wasm にビルドする
```

## 本番環境

Docker Compose で起動する場合は、`.env.example` を `.env` にコピーして本番用の値を設定する。

`main` ブランチへの push で GitHub Actions が multi-platform の Docker イメージを GitHub Container Registry に publish する。

```sh
docker compose -f compose.yml pull
docker compose -f compose.yml up -d
```

SQLite とアップロード譜面は `chart-review-data` ボリュームに保存される。停止する場合は次のコマンドを実行する。

```sh
docker compose -f compose.yml down
```
