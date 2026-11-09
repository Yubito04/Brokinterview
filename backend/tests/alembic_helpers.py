from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import text

BACKEND_DIR = Path(__file__).resolve().parent.parent


def alembic_config(connection) -> Config:
    # alembic/env.py uses this connection instead of DATABASE_URL, so the
    # migrations run on the test database and never on the development one.
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.attributes["connection"] = connection
    return config


def reset_schema(engine) -> None:
    # Start from an empty database, even if a previous run crashed and left tables
    # or enum types behind. Only call this on the test database (see db_safety.py).
    with engine.begin() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))


def upgrade_to_head(engine) -> None:
    with engine.connect() as connection:
        command.upgrade(alembic_config(connection), "head")
        connection.commit()


def downgrade_to_base(engine) -> None:
    with engine.connect() as connection:
        command.downgrade(alembic_config(connection), "base")
        connection.commit()


def upgrade_to(engine, revision: str) -> None:
    with engine.connect() as connection:
        command.upgrade(alembic_config(connection), revision)
        connection.commit()


def downgrade_to(engine, revision: str) -> None:
    with engine.connect() as connection:
        command.downgrade(alembic_config(connection), revision)
        connection.commit()
