import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import main  # noqa: E402


def test_terminal_uses_system_path_and_work_dir(tmp_path):
    original = {
        "terminal_enabled": main.settings.terminal_enabled,
        "work_dir": main.settings.work_dir,
        "audit_log": main.settings.audit_log,
    }
    object.__setattr__(main.settings, "terminal_enabled", True)
    object.__setattr__(main.settings, "work_dir", tmp_path)
    object.__setattr__(main.settings, "audit_log", tmp_path / "audit.jsonl")
    try:
        result = main.execute_safe_command("pwd")
        assert result["status"] == "ok"
        assert str(tmp_path) in result["output"]
    finally:
        for key, value in original.items():
            object.__setattr__(main.settings, key, value)
