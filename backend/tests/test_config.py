import pytest
from pydantic import ValidationError

from app.config import Settings
from app.database import create_db_engine


def test_settings_reads_database_url_from_environment(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://u:p@localhost:5432/db")

    settings = Settings(_env_file=None)

    assert settings.database_url == "postgresql+psycopg://u:p@localhost:5432/db"


def test_settings_fails_when_database_url_is_missing(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_create_db_engine_uses_configured_url(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://u:p@localhost:5432/db")

    engine = create_db_engine()

    assert engine.url.database == "db"
    assert engine.url.drivername == "postgresql+psycopg"
