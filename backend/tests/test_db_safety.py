import pytest

from db_safety import ensure_safe_test_database

DEV = "postgresql+psycopg://u:p@localhost:5432/applyflow"


def test_accepts_a_separate_database_ending_with_test():
    ensure_safe_test_database("postgresql+psycopg://u:p@localhost:5432/applyflow_test", DEV)


def test_refuses_a_missing_url():
    with pytest.raises(RuntimeError, match="missing"):
        ensure_safe_test_database(None, DEV)


def test_refuses_the_development_database():
    with pytest.raises(RuntimeError, match="_test"):
        ensure_safe_test_database(DEV, DEV)


def test_refuses_a_name_not_ending_with_test():
    with pytest.raises(RuntimeError, match="_test"):
        ensure_safe_test_database("postgresql+psycopg://u:p@localhost:5432/other", DEV)


def test_refuses_the_same_database_even_if_named_test():
    same = "postgresql+psycopg://u:p@localhost:5432/applyflow_test"
    with pytest.raises(RuntimeError, match="same database"):
        ensure_safe_test_database(same, same)
