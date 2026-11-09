from alembic import command
from sqlalchemy import inspect, text

from alembic_helpers import (
    alembic_config,
    downgrade_to,
    downgrade_to_base,
    upgrade_to,
    upgrade_to_head,
)
from app.models import ApplicationStatus

APP_TABLES = {"applications", "contacts"}

FIRST_REVISION = "8c20e896b813"  # applications and contacts, no location/deadline yet


def application_columns(engine) -> set[str]:
    return {column["name"] for column in inspect(engine).get_columns("applications")}


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


def test_second_migration_keeps_existing_rows(engine):
    # The point of this test: a migration on a table that already holds data.
    # Build the schema as it was before, insert a row, migrate, check the row.
    try:
        downgrade_to_base(engine)
        upgrade_to(engine, FIRST_REVISION)
        assert "location" not in application_columns(engine)

        with engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO applications (company, position, status) "
                    "VALUES ('Acme', 'Backend Developer', 'INTERVIEW')"
                )
            )

        upgrade_to_head(engine)

        with engine.connect() as connection:
            row = connection.execute(
                text("SELECT company, position, status, location, deadline FROM applications")
            ).one()
        # Old data untouched, new columns empty (NULL) instead of an error.
        assert tuple(row) == ("Acme", "Backend Developer", "INTERVIEW", None, None)
    finally:
        # Remove the row, then leave the schema at head for the other tests.
        downgrade_to_base(engine)
        upgrade_to_head(engine)


def test_second_migration_downgrade_removes_only_the_new_columns(engine):
    try:
        downgrade_to(engine, FIRST_REVISION)

        columns = application_columns(engine)
        assert "location" not in columns
        assert "deadline" not in columns
        assert {"id", "company", "position", "status", "created_at"} <= columns
        # Going back one step must not touch the tables or the enum type.
        assert APP_TABLES <= table_names(engine)
        assert enum_labels(engine) == [status.value for status in ApplicationStatus]
    finally:
        upgrade_to_head(engine)
