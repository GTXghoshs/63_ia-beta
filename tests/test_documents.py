import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import main  # noqa: E402


client = TestClient(main.app)


def test_upload_extract_and_delete_text_file(tmp_path):
    original_upload_dir = main.settings.upload_dir
    object.__setattr__(main.settings, "upload_dir", tmp_path)
    try:
        response = client.post("/api/files", files={"files": ("notes.txt", b"conteudo local para analise", "text/plain")})
        assert response.status_code == 200
        file_id = response.json()["files"][0]["id"]
        extracted = client.get(f"/api/files/{file_id}/extract")
        assert extracted.status_code == 200
        assert "conteudo local" in extracted.json()["text"]
        deleted = client.delete(f"/api/files/{file_id}")
        assert deleted.status_code == 200
        assert client.get(f"/api/files/{file_id}/extract").status_code == 404
    finally:
        object.__setattr__(main.settings, "upload_dir", original_upload_dir)


def test_obsidian_note_is_written_atomically_and_stays_inside_vault(tmp_path):
    original_vault = main.settings.obsidian_vault_dir
    object.__setattr__(main.settings, "obsidian_vault_dir", tmp_path)
    try:
        response = client.put("/api/obsidian/notes/Projetos/teste.md", json={"content": "# Nota local\n\nConteúdo."})
        assert response.status_code == 200
        read_back = client.get("/api/obsidian/notes/Projetos/teste.md")
        assert read_back.status_code == 200
        assert "Nota local" in read_back.json()["content"]
        notes = client.get("/api/obsidian/notes").json()["notes"]
        assert any(note["path"] == "Projetos/teste.md" for note in notes)
        blocked = client.put("/api/obsidian/notes/.obsidian/app.json", json={"content": "no"})
        assert blocked.status_code == 400
    finally:
        object.__setattr__(main.settings, "obsidian_vault_dir", original_vault)
