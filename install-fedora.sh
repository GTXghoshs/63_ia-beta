#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python3}"

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "Python 3 não encontrado. Instale-o com: sudo dnf install -y python3 python3-pip"
  exit 1
fi

mkdir -p "$PROJECT_DIR/data" "$PROJECT_DIR/models"
if [[ ! -f "$PROJECT_DIR/.env" ]]; then
  cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
  sed -i "s#^WORK_DIR=.*#WORK_DIR=$PROJECT_DIR#" "$PROJECT_DIR/.env"
  sed -i "s#^AUDIT_LOG=.*#AUDIT_LOG=$PROJECT_DIR/data/audit.jsonl#" "$PROJECT_DIR/.env"
fi

"$PYTHON_BIN" -m venv "$PROJECT_DIR/.venv"
"$PROJECT_DIR/.venv/bin/python" -m pip install --upgrade pip
"$PROJECT_DIR/.venv/bin/pip" install -r "$PROJECT_DIR/requirements.txt"

mkdir -p "$HOME/.config/systemd/user"
SERVICE_PATH="$HOME/.config/systemd/user/llama-dashboard.service"
sed "s#%h/63_ia-beta#$PROJECT_DIR#g" "$PROJECT_DIR/systemd/llama-dashboard.service" > "$SERVICE_PATH"
VAULT_DIR="$(sed -n 's/^OBSIDIAN_VAULT_DIR=//p' "$PROJECT_DIR/.env" | head -n 1)"
if [[ -n "$VAULT_DIR" && -d "$VAULT_DIR" && "$VAULT_DIR" != *" "* ]]; then
  sed -i "/^\[Install\]/i ReadWritePaths=$VAULT_DIR" "$SERVICE_PATH"
fi
systemctl --user daemon-reload

mkdir -p "$HOME/.local/share/applications"
DESKTOP_ENTRY="$HOME/.local/share/applications/63-ia-beta.desktop"
sed "s#%h/63_ia-beta#$PROJECT_DIR#g" "$PROJECT_DIR/desktop/llama-local-control.desktop" > "$DESKTOP_ENTRY"
chmod 644 "$DESKTOP_ENTRY"
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$HOME/.local/share/applications" >/dev/null 2>&1 || true
fi

cat <<EOF

Instalação concluída.

Dashboard:
  $PROJECT_DIR/bin/llama-dashboard-open
  (também instalado no menu de aplicativos como “63_ia (beta)”)

Serviço systemd:
  systemctl --user enable --now llama-dashboard.service
  systemctl --user status llama-dashboard.service

Configuração:
  $PROJECT_DIR/.env

O terminal permanece desabilitado até TERMINAL_ENABLED=true ser definido explicitamente.
EOF
