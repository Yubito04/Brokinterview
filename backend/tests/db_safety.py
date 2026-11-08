from sqlalchemy.engine import make_url


def ensure_safe_test_database(test_url: str | None, dev_url: str) -> None:
    """Raise RuntimeError unless test_url clearly points to a throwaway database.

    The test suite drops tables at the end, so pointing it at the development
    database would destroy real data.
    """
    if not test_url:
        raise RuntimeError("TEST_DATABASE_URL is missing from backend/.env")

    test_db = make_url(test_url).database
    dev_db = make_url(dev_url).database

    if not test_db or not test_db.endswith("_test"):
        raise RuntimeError(f"Test database name must end with '_test', got '{test_db}'")
    if test_db == dev_db:
        raise RuntimeError("TEST_DATABASE_URL points to the same database as DATABASE_URL")
