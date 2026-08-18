#!/usr/bin/env bash
set -Eeuo pipefail

if ! command -v flatpak >/dev/null 2>&1; then
  echo "Flatpak não encontrado. Instale-o com: sudo dnf install -y flatpak" >&2
  exit 1
fi

flatpak --user remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
flatpak --user install -y flathub md.obsidian.Obsidian

cat <<'EOF'

Obsidian instalado via Flatpak.
Abra o Obsidian, escolha ou crie seu vault e execute ./install-fedora.sh; o instalador perguntará o caminho do vault e o salvará automaticamente.
Plugins da comunidade não são instalados automaticamente; instale somente os que você revisar e realmente precisar.
EOF
