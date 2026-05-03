from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[3]
APP_DATA_DIR = ROOT_DIR / ".profession_archives"
ASSETS_DIR = APP_DATA_DIR / "assets"
DB_PATH = APP_DATA_DIR / "profession_archives.sqlite3"


@dataclass(frozen=True)
class Settings:
    app_name: str = "Profession Archives"
    database_path: Path = DB_PATH
    assets_dir: Path = ASSETS_DIR


settings = Settings()
