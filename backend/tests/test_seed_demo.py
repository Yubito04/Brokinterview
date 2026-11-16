from datetime import date, datetime, timezone
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from app.models import Application, ApplicationStatus, Contact, ContactState
from scripts import seed_demo
from scripts.seed_demo import (
    DEMO_APPLICATIONS,
    count_rows,
    ensure_safe_database,
    insert_demo_data,
    main,
)

NOW = datetime(2026, 11, 16, 12, 0, tzinfo=timezone.utc)
DEV_URL = "postgresql+psycopg://user:pw@localhost:5432/applyflow"


class TestEnsureSafeDatabase:
    def test_accepts_a_development_database(self):
        ensure_safe_database(DEV_URL)

    @pytest.mark.parametrize("name", ["applyflow_test", "other_test", "_test"])
    def test_refuses_names_ending_with_test(self, name):
        with pytest.raises(RuntimeError, match="_test"):
            ensure_safe_database(f"postgresql+psycopg://user:pw@localhost:5432/{name}")

    def test_accepts_a_name_that_only_contains_test(self):
        ensure_safe_database("postgresql+psycopg://user:pw@localhost:5432/testing_ground")

    def test_refuses_a_url_without_database_name(self):
        with pytest.raises(RuntimeError, match="no database name"):
            ensure_safe_database("postgresql+psycopg://user:pw@localhost:5432/")


class TestDemoDataContent:
    def test_has_about_thirty_applications(self):
        assert len(DEMO_APPLICATIONS) == 30

    def test_covers_every_status(self):
        assert {a.status for a in DEMO_APPLICATIONS} == set(ApplicationStatus)

    def test_has_varied_locations_including_none(self):
        locations = {a.location for a in DEMO_APPLICATIONS}
        assert None in locations
        assert len(locations - {None}) >= 5

    def test_has_past_future_and_missing_deadlines(self):
        deadlines = [a.deadline_in_days for a in DEMO_APPLICATIONS]
        assert any(d is None for d in deadlines)
        assert any(d is not None and d < 0 for d in deadlines)
        assert any(d is not None and d > 0 for d in deadlines)

    def test_a_reply_never_comes_before_the_contact(self):
        for application in DEMO_APPLICATIONS:
            for contact in application.contacts:
                if contact.replied_days_ago is not None:
                    assert contact.contacted_days_ago is not None
                    assert contact.replied_days_ago < contact.contacted_days_ago


class TestInsertDemoData:
    def test_inserts_every_application_and_contact(self, session):
        insert_demo_data(session, NOW)
        session.flush()

        expected_contacts = sum(len(a.contacts) for a in DEMO_APPLICATIONS)
        assert count_rows(session) == (30, expected_contacts)
        assert 5 <= expected_contacts <= 15

    def test_dates_are_relative_to_now(self, session):
        insert_demo_data(session, NOW)
        session.flush()

        newest = session.scalars(
            select(Application).order_by(Application.created_at.desc())
        ).first()
        assert newest.created_at == datetime(2026, 11, 15, 12, 0, tzinfo=timezone.utc)
        upcoming = session.scalars(
            select(Application).where(Application.company == "Boréalis Logiciels")
        ).one()
        assert upcoming.deadline == date(2026, 11, 28)

    def test_contacts_cover_the_three_states(self, session):
        insert_demo_data(session, NOW)
        session.flush()

        states = {contact.state for contact in session.scalars(select(Contact))}
        assert states == set(ContactState)


@pytest.fixture
def rolled_back_connection(engine, monkeypatch):
    # main() opens its own Session(engine) and commits. Giving it a connection that
    # sits inside an outer transaction keeps that commit from reaching the database:
    # the rollback at the end of the test undoes everything, like the other tests.
    connection = engine.connect()
    transaction = connection.begin()
    monkeypatch.setattr(seed_demo, "create_db_engine", lambda: connection)
    monkeypatch.setattr(
        seed_demo, "get_settings", lambda: SimpleNamespace(database_url=DEV_URL)
    )
    yield connection
    transaction.rollback()
    connection.close()


class TestMain:
    def test_refuses_a_test_database_before_touching_anything(self, monkeypatch, capsys):
        def must_not_connect():
            raise AssertionError("main() connected to the database")

        monkeypatch.setattr(
            seed_demo,
            "get_settings",
            lambda: SimpleNamespace(
                database_url="postgresql+psycopg://user:pw@localhost:5432/applyflow_test"
            ),
        )
        monkeypatch.setattr(seed_demo, "create_db_engine", must_not_connect)

        assert main([]) == 2
        assert "_test" in capsys.readouterr().err

    def test_seeds_an_empty_database(self, rolled_back_connection, session):
        assert main([]) == 0
        # `session` is a different connection: it sees nothing, the data is not committed.
        assert count_rows(session) == (0, 0)

    def test_refuses_a_database_that_already_has_rows(self, rolled_back_connection, capsys):
        assert main([]) == 0
        assert main([]) == 1
        assert "--reset" in capsys.readouterr().err
        with seed_demo.Session(rolled_back_connection) as check:
            assert count_rows(check)[0] == 30  # nothing added, nothing deleted

    def test_reset_replaces_existing_rows(self, rolled_back_connection, capsys):
        assert main([]) == 0
        assert main(["--reset"]) == 0
        assert "Deleted 30 applications" in capsys.readouterr().out
        with seed_demo.Session(rolled_back_connection) as check:
            assert count_rows(check)[0] == 30  # replaced, not doubled
            assert min(check.scalars(select(Application.id))) == 1  # ids restarted
