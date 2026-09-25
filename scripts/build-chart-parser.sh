#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/../wasm/chart-parser"
wasm-pack build --target web --release --out-dir ../../public/wasm/chart-parser
