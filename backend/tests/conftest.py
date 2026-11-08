import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import Base, get_session
from app.main import app
from db_safety import ensure_safe_test_database

_test_database_url: str | None = None


def pytest_sessionstart(session):
    # Runs before any test and before any table is created or dropped:
    # if the test database looks wrong, the whole run stops here.
    global _test_database_url
    settings = get_settings()
    try:
        ensure_safe_test_database(settings.test_database_url, settings.database_url)
    except RuntimeError as error:
        pytest.exit(f"Refusing to run the tests: {error}", returncode=2)
    _test_database_url = settings.test_database_url


@pytest.fixture(scope="session")
def engine():
    # Tables are created once for the whole run, then dropped at the end.
    test_engine = create_engine(_test_database_url)
    Base.metadata.create_all(test_engine)
    yield test_engine
    Base.metadata.drop_all(test_engine)
    test_engine.dispose()


@pytest.fixture
def session(engine):
    # Each test runs inside an outer transaction that is rolled back at the end.
    # "create_savepoint" makes the commit() calls of the routes only release a
    # savepoint, so nothing is really committed and the next test starts empty.
    connection = engine.connect()
    transaction = connection.begin()
    test_session = Session(bind=connection, join_transaction_mode="create_savepoint")
    yield test_session
    test_session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(session):
    # Routes ask for get_session: give them the test session instead.
    app.dependency_overrides[get_session] = lambda: session
    yield TestClient(app)
    app.dependency_overrides.clear()
