#!/usr/bin/env bash
set -Eeuo pipefail

if ! command -v dnf >/dev/null 2>&1; then
  echo "Este script requer Fedora/DNF." >&2
  exit 1
fi

sudo dnf install -y \
  python3 python3-pip python3-devel \
  gcc-c++ cmake make git openssl-devel \
  pciutils vulkan-tools mesa-vulkan-drivers \
  poppler-utils curl xdg-utils unzip

cat <<'EOF'

Dependências instaladas.
Agora execute:
  ./scripts/diagnose-fedora.sh

O script não instala Docker, não baixa modelos e não altera seu vault do Obsidian.
EOF
