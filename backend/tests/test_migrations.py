from alembic import command
from sqlalchemy import inspect, text

from alembic_helpers import (
    alembic_config,
    downgrade_to_base,
    upgrade_to_head,
)
from app.models import ApplicationStatus

APP_TABLES = {"applications", "contacts"}


def table_names(engine) -> set[str]:
    return set(inspect(engine).get_table_names())


def enum_labels(engine) -> list[str]:
    # Values of the PostgreSQL enum type created for Application.status.
    query = text(
        "SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid "
        "WHERE t.typname = 'applicationstatus' ORDER BY e.enumsortorder"
    )
    with engine.connect() as connection:
        return [row[0] for row in connection.execute(query)]


def test_models_and_migrations_are_in_sync(engine):
    # Fails if a model was changed without writing a migration for it.
    # `alembic check` raises an error when autogenerate would produce a change.
    with engine.connect() as connection:
        command.check(alembic_config(connection))


def test_upgrade_downgrade_upgrade_round_trip(engine):
    try:
        downgrade_to_base(engine)

        # After the downgrade: no application table and no enum type left behind.
        assert not APP_TABLES & table_names(engine)
        assert enum_labels(engine) == []

        upgrade_to_head(engine)

        assert APP_TABLES <= table_names(engine)
        assert enum_labels(engine) == [status.value for status in ApplicationStatus]
    finally:
        # Whatever happened, leave the schema at head for the other tests.
        upgrade_to_head(engine)
