#!/usr/bin/env bash
set -Eeuo pipefail

section() { printf '\n=== %s ===\n' "$1"; }

section "Sistema"
cat /etc/fedora-release 2>/dev/null || true
uname -a

section "CPU"
lscpu | grep -E '^(Model name|CPU\(s\)|Thread|Core|Socket|Flags):' || lscpu

section "Memória"
free -h

section "GPU e driver"
if command -v lspci >/dev/null 2>&1; then
  lspci -k | grep -A 3 -Ei 'vga|3d|display' || true
else
  echo "lspci não encontrado; instale pciutils para identificar a GPU"
fi

section "Vulkan"
if command -v vulkaninfo >/dev/null 2>&1; then
  vulkaninfo --summary 2>/dev/null || vulkaninfo --summary
else
  echo "vulkaninfo não encontrado"
fi

section "llama.cpp"
if command -v llama-server >/dev/null 2>&1; then
  command -v llama-server
  llama-server --version || true
  echo '-- dispositivos llama.cpp --'
  llama-server --list-devices || true
else
  echo "llama-server não encontrado no PATH"
fi

section "Armazenamento"
df -h . "$HOME" 2>/dev/null || df -h

section "Projeto"
printf 'Diretório: %s\n' "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
printf 'Modelos configurados: %s\n' "${MODEL_DIR:-$HOME/Models}"
printf 'Vault Obsidian: %s\n' "${OBSIDIAN_VAULT_DIR:-não configurado}"
printf 'Backend llama.cpp: %s\n' "${LLAMA_BACKEND:-auto}"
printf 'GPUs selecionadas: %s\n' "${LLAMA_GPU_IDS:-auto}"
printf 'Split mode: %s\n' "${LLAMA_SPLIT_MODE:-layer}"
printf 'Tensor split: %s\n' "${LLAMA_TENSOR_SPLIT:-auto}"
