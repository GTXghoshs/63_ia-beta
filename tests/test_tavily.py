import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import main  # noqa: E402


client = TestClient(main.app)


class FakeResponse:
    status_code = 200
    text = ""

    def json(self):
        return {
            "query": "Vulkan multi-GPU llama.cpp",
            "answer": "Resumo seguro.",
            "results": [{"title": "Fonte oficial", "url": "https://example.com/source", "content": "Trecho da fonte", "score": 0.91}],
            "images": [],
            "response_time": 0.42,
            "usage": {"credits": 1},
            "request_id": "test-request",
        }


def test_tavily_search_uses_bearer_and_local_cache(tmp_path, monkeypatch):
    original = {
        "enabled": main.settings.tavily_enabled,
        "api_key": main.settings.tavily_api_key,
        "depth": main.settings.tavily_search_depth,
        "max_results": main.settings.tavily_max_results,
        "cache_ttl": main.settings.tavily_cache_ttl,
    }
    object.__setattr__(main.settings, "tavily_enabled", True)
    object.__setattr__(main.settings, "tavily_api_key", "tvly-test-secret")
    object.__setattr__(main.settings, "tavily_search_depth", "basic")
    object.__setattr__(main.settings, "tavily_max_results", 5)
    object.__setattr__(main.settings, "tavily_cache_ttl", 900)
    monkeypatch.setattr(main, "TAVILY_CACHE_PATH", tmp_path / "tavily-cache.json")
    calls = []

    def fake_post(url, headers, json, timeout):
        calls.append({"url": url, "headers": headers, "json": json, "timeout": timeout})
        return FakeResponse()

    monkeypatch.setattr(main.requests, "post", fake_post)
    try:
        response = client.post("/api/tavily/search", json={"query": "Vulkan multi-GPU llama.cpp", "max_results": 5})
        assert response.status_code == 200
        assert response.json()["results"][0]["title"] == "Fonte oficial"
        assert calls[0]["url"] == "https://api.tavily.com/search"
        assert calls[0]["headers"]["Authorization"] == "Bearer tvly-test-secret"
        assert calls[0]["json"]["search_depth"] == "basic"
        cached = client.post("/api/tavily/search", json={"query": "Vulkan multi-GPU llama.cpp", "max_results": 5})
        assert cached.status_code == 200
        assert cached.json()["cached"] is True
        assert len(calls) == 1
        public = client.get("/api/config").json()
        assert "tavily_api_key" not in public
    finally:
        object.__setattr__(main.settings, "tavily_enabled", original["enabled"])
        object.__setattr__(main.settings, "tavily_api_key", original["api_key"])
        object.__setattr__(main.settings, "tavily_search_depth", original["depth"])
        object.__setattr__(main.settings, "tavily_max_results", original["max_results"])
        object.__setattr__(main.settings, "tavily_cache_ttl", original["cache_ttl"])


def test_tavily_disabled_does_not_call_remote(monkeypatch):
    original_enabled = main.settings.tavily_enabled
    original_key = main.settings.tavily_api_key
    object.__setattr__(main.settings, "tavily_enabled", False)
    object.__setattr__(main.settings, "tavily_api_key", "tvly-test-secret")
    monkeypatch.setattr(main.requests, "post", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("não deveria chamar a Tavily")))
    try:
        response = client.post("/api/tavily/search", json={"query": "teste"})
        assert response.status_code == 403
    finally:
        object.__setattr__(main.settings, "tavily_enabled", original_enabled)
        object.__setattr__(main.settings, "tavily_api_key", original_key)
