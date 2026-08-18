#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python3}"
ENV_FILE="$PROJECT_DIR/.env"

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "Python 3 não encontrado. Instale-o com: sudo dnf install -y python3 python3-pip" >&2
  exit 1
fi

mkdir -p "$PROJECT_DIR/data" "$PROJECT_DIR/models"
if [[ ! -f "$ENV_FILE" ]]; then
  cp "$PROJECT_DIR/.env.example" "$ENV_FILE"
fi

write_env_value() {
  "$PYTHON_BIN" - "$ENV_FILE" "$1" "$2" <<'PY'
from pathlib import Path
import re
import sys

env_path = Path(sys.argv[1])
key = sys.argv[2]
value = sys.argv[3]
lines = env_path.read_text(encoding="utf-8").splitlines()
serialized = value
if re.search(r"[\s#\"']", value):
    serialized = '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'
replacement = f"{key}={serialized}"
found = False
for index, line in enumerate(lines):
    if line.startswith(key + "="):
        lines[index] = replacement
        found = True
        break
if not found:
    lines.append(replacement)
env_path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
PY
}

read_env_value() {
  "$PYTHON_BIN" - "$ENV_FILE" "$1" <<'PY'
from pathlib import Path
import ast
import sys

env_path = Path(sys.argv[1])
key = sys.argv[2]
for line in env_path.read_text(encoding="utf-8").splitlines():
    if line.startswith(key + "="):
        value = line.split("=", 1)[1].strip()
        if len(value) >= 2 and value[0] == '"' and value[-1] == '"':
            try:
                value = ast.literal_eval(value)
            except (SyntaxError, ValueError):
                value = value[1:-1]
        print(value)
        break
PY
}

expand_user_path() {
  local value="$1"
  case "$value" in
    "~") printf '%s\n' "$HOME" ;;
    "~/"*) printf '%s/%s\n' "$HOME" "${value#~/}" ;;
    /*) printf '%s\n' "$value" ;;
    *) printf '%s/%s\n' "$PWD" "$value" ;;
  esac
}

prompt_path() {
  local label="$1"
  local default_value="$2"
  local value=""
  if [[ ! -t 0 || "${INSTALL_NONINTERACTIVE:-false}" == "true" ]]; then
    printf '%s\n' "$default_value"
    return
  fi
  if [[ -n "$default_value" ]]; then
    read -r -p "$label [$default_value]: " value
    printf '%s\n' "${value:-$default_value}"
  else
    read -r -p "$label (Enter para deixar desativado): " value
    printf '%s\n' "$value"
  fi
}

MODEL_DIR_DEFAULT="$(read_env_value MODEL_DIR)"
MODEL_DIR_DEFAULT="$(expand_user_path "${MODEL_DIR_DEFAULT:-$PROJECT_DIR/models}")"
MODEL_DIR="$(prompt_path "Diretório dos modelos GGUF" "$MODEL_DIR_DEFAULT")"
MODEL_DIR="$(expand_user_path "$MODEL_DIR")"
if [[ -z "$MODEL_DIR" ]]; then
  echo "O diretório de modelos não pode ficar vazio." >&2
  exit 2
fi
mkdir -p "$MODEL_DIR"
write_env_value MODEL_DIR "$MODEL_DIR"

VAULT_DIR_DEFAULT="$(read_env_value OBSIDIAN_VAULT_DIR)"
if [[ -n "$VAULT_DIR_DEFAULT" ]]; then
  VAULT_DIR_DEFAULT="$(expand_user_path "$VAULT_DIR_DEFAULT")"
fi
VAULT_DIR="$(prompt_path "Caminho do vault do Obsidian" "$VAULT_DIR_DEFAULT")"
if [[ -n "$VAULT_DIR" ]]; then
  VAULT_DIR="$(expand_user_path "$VAULT_DIR")"
  mkdir -p "$VAULT_DIR"
fi
write_env_value OBSIDIAN_VAULT_DIR "$VAULT_DIR"

write_env_value WORK_DIR "$PROJECT_DIR"
write_env_value AUDIT_LOG "$PROJECT_DIR/data/audit.jsonl"
chmod 600 "$ENV_FILE"

"$PYTHON_BIN" -m venv "$PROJECT_DIR/.venv"
"$PROJECT_DIR/.venv/bin/python" -m pip install --upgrade pip
"$PROJECT_DIR/.venv/bin/pip" install -r "$PROJECT_DIR/requirements.txt"

mkdir -p "$HOME/.config/systemd/user"
SERVICE_PATH="$HOME/.config/systemd/user/llama-dashboard.service"
sed "s#%h/63_ia-beta#$PROJECT_DIR#g" "$PROJECT_DIR/systemd/llama-dashboard.service" > "$SERVICE_PATH"
if [[ -n "$VAULT_DIR" && -d "$VAULT_DIR" ]]; then
  VAULT_UNIT_PATH="$VAULT_DIR"
  VAULT_UNIT_PATH="${VAULT_UNIT_PATH// /\\x20}"
  VAULT_UNIT_PATH="${VAULT_UNIT_PATH//$'\t'/\\x09}"
  "$PYTHON_BIN" - "$SERVICE_PATH" "$VAULT_UNIT_PATH" <<'PY'
from pathlib import Path
import sys

service_path = Path(sys.argv[1])
read_write_path = sys.argv[2]
lines = service_path.read_text(encoding="utf-8").splitlines()
for index, line in enumerate(lines):
    if line.strip() == "[Install]":
        lines.insert(index, f"ReadWritePaths={read_write_path}")
        break
service_path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
PY
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

Configuração definida durante a instalação:
  Modelos GGUF: $MODEL_DIR
  Vault Obsidian: ${VAULT_DIR:-desativado}

Dashboard:
  $PROJECT_DIR/bin/llama-dashboard-open
  (também instalado no menu de aplicativos como “63_ia (beta)”)

Serviço systemd:
  systemctl --user enable --now llama-dashboard.service
  systemctl --user status llama-dashboard.service

O arquivo .env foi gerado automaticamente com permissões restritas.
O terminal permanece desabilitado até TERMINAL_ENABLED=true ser definido explicitamente.
EOF
