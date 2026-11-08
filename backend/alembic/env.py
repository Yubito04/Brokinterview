from logging.config import fileConfig

from alembic import context

from app import models  # noqa: F401  (importing it registers the tables on Base)
from app.config import get_settings
from app.database import Base, create_db_engine

config = context.config

if config.config_file_name is not None:
    # Keep the loggers of pytest and of the app alive when tests call Alembic.
    fileConfig(config.config_file_name, disable_existing_loggers=False)

# Alembic compares this metadata with the real database to autogenerate migrations.
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Print the SQL instead of running it (alembic upgrade head --sql)."""
    context.configure(
        url=get_settings().database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run the migrations on a real database."""
    # The tests hand over an open connection to their own test database.
    # Otherwise we connect to DATABASE_URL, read from backend/.env.
    connection = config.attributes.get("connection")
    if connection is not None:
        run_with(connection)
        return

    engine = create_db_engine()
    with engine.connect() as connection:
        run_with(connection)
    engine.dispose()


def run_with(connection) -> None:
    # compare_type: also detect a changed column type (for example String(200) -> String(100)).
    context.configure(
        connection=connection, target_metadata=target_metadata, compare_type=True
    )
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
