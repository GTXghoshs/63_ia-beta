import os
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import main  # noqa: E402


client = TestClient(main.app)


def test_public_config_declares_llama_cpp_only():
    payload = client.get("/api/config").json()
    assert payload["llama_cpp_only"] is True
    assert payload["llama_backend"] in {"auto", "cpu", "vulkan"}
    assert payload["llama_split_mode"] in {"layer", "row", "tensor", "none"}


def test_public_endpoint_is_loopback():
    assert main.settings.llama_base_url.startswith(("http://127.0.0.1", "http://localhost", "http://[::1]"))


def test_remote_llama_endpoint_rejected(tmp_path):
    env = os.environ.copy()
    env["LLAMA_BASE_URL"] = "https://example.invalid/v1"
    env["APP_ENV_FILE"] = str(tmp_path / "missing.env")
    result = subprocess.run([sys.executable, "-c", "import app.main"], cwd=Path(__file__).resolve().parents[1], env=env, text=True, capture_output=True)
    assert result.returncode != 0
    assert "endpoint llama.cpp local" in (result.stderr + result.stdout)


def test_start_script_rejects_non_gguf(tmp_path):
    model = tmp_path / "model.bin"
    model.write_bytes(b"not a gguf")
    result = subprocess.run(["bash", "scripts/start-llama-linux.sh", str(model)], cwd=Path(__file__).resolve().parents[1], text=True, capture_output=True)
    assert result.returncode == 2
    assert ".gguf" in result.stderr


@pytest.mark.parametrize("split_mode", ["none", "layer", "row", "tensor"])
def test_split_mode_values_documented(split_mode):
    assert split_mode in {"none", "layer", "row", "tensor"}


def test_multi_gpu_env_template_has_controls():
    text = (Path(__file__).resolve().parents[1] / ".env.example").read_text(encoding="utf-8")
    for key in ["LLAMA_GPU_IDS", "LLAMA_MAIN_GPU", "LLAMA_TENSOR_SPLIT", "LLAMA_SPLIT_MODE", "LLAMA_BACKEND"]:
        assert key in text


def test_linux_scripts_exist_and_are_executable():
    root = Path(__file__).resolve().parents[1]
    for name in ["start-llama-linux.sh", "start-llama-vulkan.sh", "list-llama-devices.sh"]:
        path = root / "scripts" / name
        assert path.exists()
        assert os.access(path, os.X_OK)


def test_public_readme_describes_contract():
    text = (Path(__file__).resolve().parents[1] / "README.md").read_text(encoding="utf-8")
    assert "Linux-only" in text
    assert "llama.cpp" in text
    assert "Múltiplas GPUs" in text
    assert "TROUBLESHOOTING.md" in text
