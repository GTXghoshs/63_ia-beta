import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import main  # noqa: E402


class FakeResponse:
    status_code = 200

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def iter_lines(self, decode_unicode=True):
        yield 'data: ' + json.dumps({"choices": [{"delta": {"content": "Olá"}}]})
        yield 'data: ' + json.dumps({"choices": [{"delta": {"content": " local"}}]})
        yield 'data: [DONE]'


def test_stream_llama_translates_sse(monkeypatch):
    monkeypatch.setattr(main.requests, "post", lambda *args, **kwargs: FakeResponse())
    events = list(main.stream_llama({"messages": [], "stream": True}))
    assert any('"text": "Olá"' in event for event in events)
    assert any('"text": " local"' in event for event in events)
    assert any("event: done" in event for event in events)
