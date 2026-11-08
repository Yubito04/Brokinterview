from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session

from app.config import get_settings


class Base(DeclarativeBase):
    # Every table model inherits from Base, so SQLAlchemy can find them all.
    pass


def create_db_engine() -> Engine:
    # The engine manages the connections to PostgreSQL.
    # create_engine does not connect yet: the first query does.
    return create_engine(get_settings().database_url)


@lru_cache
def get_engine() -> Engine:
    # One engine for the whole app: it holds a pool of reusable connections,
    # so we must not build a new one for every request.
    return create_db_engine()


def get_session() -> Iterator[Session]:
    # FastAPI dependency: each request gets its own session, closed afterwards.
    # Tests replace this function to use the test database instead.
    with Session(get_engine()) as session:
        yield session
