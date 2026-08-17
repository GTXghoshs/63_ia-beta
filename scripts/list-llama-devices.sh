#!/usr/bin/env bash
set -Eeuo pipefail

SERVER_BIN="${LLAMA_SERVER_BIN:-llama-server}"
if ! command -v "$SERVER_BIN" >/dev/null 2>&1 && [[ ! -x "$SERVER_BIN" ]]; then
  echo "llama-server não encontrado no PATH ou em LLAMA_SERVER_BIN." >&2
  exit 1
fi

"$SERVER_BIN" --list-devices
