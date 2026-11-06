from sqlalchemy import Engine, create_engine

from app.config import get_settings


def create_db_engine() -> Engine:
    # The engine manages the connections to PostgreSQL.
    # create_engine does not connect yet: the first query does.
    return create_engine(get_settings().database_url)
