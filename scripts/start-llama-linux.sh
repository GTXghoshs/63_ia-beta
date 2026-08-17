#!/usr/bin/env bash
set -Eeuo pipefail

MODEL_PATH="${1:-${LLAMA_MODEL_PATH:-}}"
if [[ -z "$MODEL_PATH" ]]; then
  echo "Uso: $0 /caminho/para/modelo.gguf" >&2
  echo "Ou defina LLAMA_MODEL_PATH no .env." >&2
  exit 2
fi
if [[ ! -f "$MODEL_PATH" ]]; then
  echo "Modelo não encontrado: $MODEL_PATH" >&2
  exit 1
fi
if [[ "${MODEL_PATH,,}" != *.gguf ]]; then
  echo "O projeto público aceita somente modelos locais com extensão .gguf." >&2
  exit 2
fi

SERVER_BIN="${LLAMA_SERVER_BIN:-llama-server}"
if ! command -v "$SERVER_BIN" >/dev/null 2>&1 && [[ ! -x "$SERVER_BIN" ]]; then
  echo "llama-server não encontrado no PATH ou em LLAMA_SERVER_BIN." >&2
  exit 1
fi

PORT="${LLAMA_PORT:-8080}"
CONTEXT="${LLAMA_CONTEXT_SIZE:-16384}"
GPU_LAYERS="${LLAMA_N_GPU_LAYERS:-999}"
ALIAS="${LLAMA_MODEL_ALIAS:-63-ia-local}"
BACKEND="${LLAMA_BACKEND:-auto}"
GPU_IDS="${LLAMA_GPU_IDS:-}"
MAIN_GPU="${LLAMA_MAIN_GPU:-0}"
TENSOR_SPLIT="${LLAMA_TENSOR_SPLIT:-}"
SPLIT_MODE="${LLAMA_SPLIT_MODE:-layer}"

if [[ "$BACKEND" != "auto" && "$BACKEND" != "cpu" && "$BACKEND" != "vulkan" ]]; then
  echo "LLAMA_BACKEND deve ser auto, cpu ou vulkan." >&2
  exit 2
fi
if [[ "$SPLIT_MODE" != "none" && "$SPLIT_MODE" != "layer" && "$SPLIT_MODE" != "row" && "$SPLIT_MODE" != "tensor" ]]; then
  echo "LLAMA_SPLIT_MODE deve ser none, layer, row ou tensor." >&2
  exit 2
fi
if [[ "$SPLIT_MODE" == "row" ]]; then
  echo "Aviso: split-mode=row é legado/depreciado no llama.cpp; prefira layer ou tensor após validar." >&2
fi
if [[ "$SPLIT_MODE" == "tensor" ]]; then
  echo "Aviso: split-mode=tensor é experimental; valide no hardware antes de usar em produção." >&2
fi

ARGS=(
  -m "$MODEL_PATH"
  --host 127.0.0.1
  --port "$PORT"
  --alias "$ALIAS"
  --ctx-size "$CONTEXT"
  --metrics
)

if [[ "$BACKEND" == "cpu" ]]; then
  ARGS+=(--n-gpu-layers 0)
else
  ARGS+=(--n-gpu-layers "$GPU_LAYERS" --split-mode "$SPLIT_MODE")
  if [[ -n "$GPU_IDS" ]]; then
    ARGS+=(--device "$GPU_IDS")
  fi
  if [[ -n "$TENSOR_SPLIT" ]]; then
    ARGS+=(--tensor-split "$TENSOR_SPLIT")
  fi
  if [[ "$SPLIT_MODE" == "none" ]]; then
    ARGS+=(--main-gpu "$MAIN_GPU")
  fi
fi

printf 'Iniciando llama.cpp: backend=%s split=%s devices=%s model=%s\n' "$BACKEND" "$SPLIT_MODE" "${GPU_IDS:-auto}" "$MODEL_PATH"
exec "$SERVER_BIN" "${ARGS[@]}"
