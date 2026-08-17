import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app, path_is_inside, validate_command  # noqa: E402


client = TestClient(app)


def test_healthz_is_local_and_available():
    response = client.get("/api/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_config_does_not_expose_api_key():
    response = client.get("/api/config")
    assert response.status_code == 200
    assert "llama_api_key" not in response.json()


def test_terminal_is_disabled_by_default():
    response = client.post("/api/terminal", json={"command": "pwd"})
    assert response.status_code == 403


def test_allowlist_accepts_read_only_commands():
    assert validate_command("pwd") == ["pwd"]
    assert validate_command("ls -lah") == ["ls", "-lah"]
    assert validate_command("free -h") == ["free", "-h"]
    assert validate_command("llama-server --version") == ["llama-server", "--version"]


def test_allowlist_rejects_shell_metacharacters():
    for command in ["pwd; whoami", "ls | cat", "echo $HOME", "ls > output.txt", "$(whoami)"]:
        try:
            validate_command(command)
        except ValueError:
            pass
        else:
            raise AssertionError(f"comando deveria ser rejeitado: {command}")


def test_allowlist_rejects_unknown_program():
    try:
        validate_command("sudo dnf update")
    except ValueError as exc:
        assert "não permitido" in str(exc)
    else:
        raise AssertionError("sudo não pode fazer parte da allowlist")


def test_relative_path_cannot_escape_work_dir(tmp_path):
    (tmp_path / "inside").mkdir()
    assert path_is_inside("inside", tmp_path)
    assert not path_is_inside("../", tmp_path)
