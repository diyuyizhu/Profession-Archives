from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app import db as db_module
from backend.app.core import config as config_module
from backend.app.main import app


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    settings = config_module.Settings(
        database_path=tmp_path / "profession_archives.sqlite3",
        assets_dir=tmp_path / "assets",
    )
    monkeypatch.setattr(config_module, "settings", settings, raising=False)
    monkeypatch.setattr(db_module, "settings", settings, raising=False)
    db_module.init_db()

    with TestClient(app) as test_client:
        yield test_client
