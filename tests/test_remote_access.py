import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import main  # noqa: E402


def test_remote_access_requires_token_and_sets_session_cookie():
    original_enabled = main.settings.remote_access_enabled
    original_token = main.settings.remote_access_token
    object.__setattr__(main.settings, "remote_access_enabled", True)
    object.__setattr__(main.settings, "remote_access_token", "token-de-teste-robusto")
    client = TestClient(main.app)
    try:
        protected = client.get("/api/status")
        assert protected.status_code == 401
        login_failed = client.post("/api/auth/login", json={"password": "errado"})
        assert login_failed.status_code == 401
        login_ok = client.post("/api/auth/login", json={"password": "token-de-teste-robusto"})
        assert login_ok.status_code == 200
        assert "llama_session" in login_ok.headers.get("set-cookie", "")
        authenticated = client.get("/api/status")
        assert authenticated.status_code == 200
        logout = client.post("/api/auth/logout")
        assert logout.status_code == 200
        assert client.get("/api/status").status_code == 401
    finally:
        object.__setattr__(main.settings, "remote_access_enabled", original_enabled)
        object.__setattr__(main.settings, "remote_access_token", original_token)


def test_remote_access_disabled_keeps_local_workflow_open():
    original_enabled = main.settings.remote_access_enabled
    original_token = main.settings.remote_access_token
    object.__setattr__(main.settings, "remote_access_enabled", False)
    object.__setattr__(main.settings, "remote_access_token", "")
    try:
        response = TestClient(main.app).get("/api/status")
        assert response.status_code == 200
    finally:
        object.__setattr__(main.settings, "remote_access_enabled", original_enabled)
        object.__setattr__(main.settings, "remote_access_token", original_token)
