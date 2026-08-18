import json
import sys
from pathlib import Path

import pytest
import requests
from fastapi import HTTPException
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import main  # noqa: E402


client = TestClient(main.app)


class FakeStreamingResponse:
    status_code = 200
    text = ""

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def iter_lines(self, decode_unicode=True):
        yield json.dumps({"choices": [{"delta": {"reasoning_content": "não deve aparecer"}}]}, ensure_ascii=False)
        yield json.dumps({"choices": [{"delta": {"content": "Olá, código local"}}]}, ensure_ascii=False)
        yield json.dumps({"usage": {"prompt_tokens": 4, "completion_tokens": 2}}, ensure_ascii=False)
        yield "data: [DONE]"


# 01

def test_01_healthz():
    response = client.get("/api/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


# 02

def test_02_root_serves_dashboard():
    response = client.get("/")
    assert response.status_code == 200
    assert "63_ia" in response.text


# 03

def test_03_security_headers():
    headers = client.get("/api/healthz").headers
    assert headers["x-content-type-options"] == "nosniff"
    assert headers["x-frame-options"] == "DENY"
    assert "default-src 'self'" in headers["content-security-policy"]


# 04

def test_04_public_config_hides_secrets():
    payload = client.get("/api/config").json()
    assert "llama_api_key" not in payload
    assert "tavily_api_key" not in payload
    assert "remote_access_token" not in payload


# 05

def test_05_status_contract():
    payload = client.get("/api/status").json()
    assert {"llama", "models_on_disk", "terminal", "timestamp"}.issubset(payload)
    assert isinstance(payload["models_on_disk"], int)


# 06

def test_06_models_contract():
    payload = client.get("/api/models").json()
    assert {"server", "disk", "model_dir"}.issubset(payload)
    assert isinstance(payload["server"], list)
    assert isinstance(payload["disk"], list)


# 07

def test_07_metrics_contract():
    payload = client.get("/api/metrics").json()
    assert {"available", "status_code", "text"}.issubset(payload)


# 08

def test_08_audit_contract():
    payload = client.get("/api/audit?limit=5").json()
    assert "events" in payload
    assert len(payload["events"]) <= 5


# 09

def test_09_chat_rejects_invalid_role():
    response = client.post("/api/chat/stream", json={"messages": [{"role": "hacker", "content": "x"}]})
    assert response.status_code == 422


# 10

def test_10_chat_rejects_invalid_generation_parameters():
    response = client.post("/api/chat/stream", json={"messages": [{"role": "user", "content": "x"}], "temperature": 3})
    assert response.status_code == 422


# 11

def test_11_chat_stream_success(monkeypatch):
    calls = []

    def fake_post(url, **kwargs):
        calls.append((url, kwargs))
        return FakeStreamingResponse()

    monkeypatch.setattr(main.requests, "post", fake_post)
    response = client.post("/api/chat/stream", json={"messages": [{"role": "user", "content": "oi"}]})
    assert response.status_code == 200
    assert "event: delta" in response.text
    assert "Olá, código local" in response.text
    assert "event: reasoning" not in response.text
    assert "não deve aparecer" not in response.text
    assert "event: done" in response.text
    assert calls[0][0].endswith("/v1/chat/completions")


# 12

def test_12_chat_stream_network_error(monkeypatch):
    def fake_post(*args, **kwargs):
        raise requests.RequestException("llama offline")

    monkeypatch.setattr(main.requests, "post", fake_post)
    response = client.post("/api/chat/stream", json={"messages": [{"role": "user", "content": "oi"}]})
    assert response.status_code == 200
    assert "Não foi possível conectar ao llama.cpp" in response.text
    assert "event: error" in response.text


# 13

def test_13_tavily_status_disabled():
    original = main.settings.tavily_enabled
    object.__setattr__(main.settings, "tavily_enabled", False)
    try:
        payload = client.get("/api/tavily/status").json()
        assert payload["enabled"] is False
    finally:
        object.__setattr__(main.settings, "tavily_enabled", original)


# 14

def test_14_tavily_disabled_blocks_request(monkeypatch):
    original_enabled = main.settings.tavily_enabled
    original_key = main.settings.tavily_api_key
    object.__setattr__(main.settings, "tavily_enabled", False)
    object.__setattr__(main.settings, "tavily_api_key", "tvly-test")
    monkeypatch.setattr(main.requests, "post", lambda *a, **k: pytest.fail("Tavily não deveria ser chamada"))
    try:
        response = client.post("/api/tavily/search", json={"query": "teste"})
        assert response.status_code == 403
    finally:
        object.__setattr__(main.settings, "tavily_enabled", original_enabled)
        object.__setattr__(main.settings, "tavily_api_key", original_key)


# 15

def test_15_tavily_bearer_and_cache(monkeypatch, tmp_path):
    original = (main.settings.tavily_enabled, main.settings.tavily_api_key, main.settings.tavily_cache_ttl)
    object.__setattr__(main.settings, "tavily_enabled", True)
    object.__setattr__(main.settings, "tavily_api_key", "tvly-battery")
    object.__setattr__(main.settings, "tavily_cache_ttl", 900)
    monkeypatch.setattr(main, "TAVILY_CACHE_PATH", tmp_path / "cache.json")
    calls = []

    class Response:
        status_code = 200
        text = ""

        def json(self):
            return {"answer": "resumo", "results": [{"title": "fonte", "url": "https://example.com", "content": "trecho", "score": 0.8}]}

    def fake_post(url, headers, json, timeout):
        calls.append((url, headers, json, timeout))
        return Response()

    monkeypatch.setattr(main.requests, "post", fake_post)
    try:
        first = client.post("/api/tavily/search", json={"query": "fedora local"})
        second = client.post("/api/tavily/search", json={"query": "fedora local"})
        assert first.status_code == 200
        assert second.json()["cached"] is True
        assert calls[0][1]["Authorization"] == "Bearer tvly-battery"
        assert len(calls) == 1
    finally:
        object.__setattr__(main.settings, "tavily_enabled", original[0])
        object.__setattr__(main.settings, "tavily_api_key", original[1])
        object.__setattr__(main.settings, "tavily_cache_ttl", original[2])


# 16

def test_16_files_list_contract(tmp_path):
    original = main.settings.upload_dir
    object.__setattr__(main.settings, "upload_dir", tmp_path)
    try:
        assert client.get("/api/files").json()["files"] == []
    finally:
        object.__setattr__(main.settings, "upload_dir", original)


# 17

def test_17_upload_and_extract_text(tmp_path):
    original = main.settings.upload_dir
    object.__setattr__(main.settings, "upload_dir", tmp_path)
    try:
        response = client.post("/api/files", files=[("files", ("note.txt", b"conteudo local", "text/plain"))])
        assert response.status_code == 200
        file_id = response.json()["files"][0]["id"]
        extracted = client.get(f"/api/files/{file_id}/extract")
        assert extracted.status_code == 200
        assert "conteudo local" in extracted.json()["text"]
    finally:
        object.__setattr__(main.settings, "upload_dir", original)


# 18

def test_18_upload_sanitizes_path(tmp_path):
    original = main.settings.upload_dir
    object.__setattr__(main.settings, "upload_dir", tmp_path)
    try:
        response = client.post("/api/files", files=[("files", ("../../escape.txt", b"safe", "text/plain"))])
        assert response.status_code == 200
        stored = response.json()["files"][0]["name"]
        assert "/" not in stored and ".." not in stored
    finally:
        object.__setattr__(main.settings, "upload_dir", original)


# 19

def test_19_delete_upload(tmp_path):
    original = main.settings.upload_dir
    object.__setattr__(main.settings, "upload_dir", tmp_path)
    try:
        response = client.post("/api/files", files=[("files", ("delete.txt", b"x", "text/plain"))])
        file_id = response.json()["files"][0]["id"]
        deleted = client.delete(f"/api/files/{file_id}")
        assert deleted.status_code == 200
        assert client.get(f"/api/files/{file_id}/extract").status_code == 404
    finally:
        object.__setattr__(main.settings, "upload_dir", original)


# 20

def test_20_upload_file_count_limit(tmp_path):
    original_upload = main.settings.upload_dir
    original = main.settings.max_upload_files
    object.__setattr__(main.settings, "upload_dir", tmp_path)
    object.__setattr__(main.settings, "max_upload_files", 2)
    try:
        files = [("files", (f"f{i}.txt", b"x", "text/plain")) for i in range(3)]
        response = client.post("/api/files", files=files)
        assert response.status_code == 413
    finally:
        object.__setattr__(main.settings, "max_upload_files", original)
        object.__setattr__(main.settings, "upload_dir", original_upload)


# 21

def test_21_obsidian_status_unconfigured():
    original = main.settings.obsidian_vault_dir
    object.__setattr__(main.settings, "obsidian_vault_dir", None)
    try:
        payload = client.get("/api/obsidian/status").json()
        assert payload["configured"] is False
    finally:
        object.__setattr__(main.settings, "obsidian_vault_dir", original)


# 22

def test_22_obsidian_path_traversal_blocked(tmp_path):
    original = main.settings.obsidian_vault_dir
    object.__setattr__(main.settings, "obsidian_vault_dir", tmp_path)
    try:
        with pytest.raises(HTTPException):
            main.safe_vault_path("../outside.md")
    finally:
        object.__setattr__(main.settings, "obsidian_vault_dir", original)


# 23

def test_23_terminal_disabled():
    original = main.settings.terminal_enabled
    object.__setattr__(main.settings, "terminal_enabled", False)
    try:
        response = client.post("/api/terminal", json={"command": "vulkaninfo --summary"})
        assert response.status_code == 403
    finally:
        object.__setattr__(main.settings, "terminal_enabled", original)


# 24

def test_24_terminal_shell_metacharacters_blocked():
    original = main.settings.terminal_enabled
    object.__setattr__(main.settings, "terminal_enabled", True)
    try:
        response = client.post("/api/terminal", json={"command": "vulkaninfo --summary; rm -rf /"})
        assert response.status_code == 400
    finally:
        object.__setattr__(main.settings, "terminal_enabled", original)


# 25

def test_25_remote_auth_flow():
    original_enabled = main.settings.remote_access_enabled
    original_token = main.settings.remote_access_token
    object.__setattr__(main.settings, "remote_access_enabled", True)
    object.__setattr__(main.settings, "remote_access_token", "battery-remote-token")
    remote = TestClient(main.app)
    try:
        assert remote.get("/api/status").status_code == 401
        assert remote.post("/api/auth/login", json={"password": "wrong"}).status_code == 401
        assert remote.post("/api/auth/login", json={"password": "battery-remote-token"}).status_code == 200
        assert remote.get("/api/status").status_code == 200
        assert remote.post("/api/auth/logout").status_code == 200
        assert remote.get("/api/status").status_code == 401
    finally:
        object.__setattr__(main.settings, "remote_access_enabled", original_enabled)
        object.__setattr__(main.settings, "remote_access_token", original_token)
