from datetime import date

import pytest
from sqlalchemy import func, select

from app.config import Settings
from app.llm import ExtractedJob, ExtractionFailed, ExtractionUnavailable, get_job_extractor
from app.main import app
from app.models import Application, Contact
from fakes import FakeJobExtractor

FULL_RESULT = ExtractedJob(
    company="Acme",
    position="Backend Developer",
    location="Montreal",
    deadline=date(2026, 12, 15),
    skills=["Python", "PostgreSQL"],
)
EMPTY_RESULT = ExtractedJob(
    company=None, position=None, location=None, deadline=None, skills=None
)


@pytest.fixture
def use_extractor(client):
    # Plugs a fake extractor into the app for one test (the `client` fixture
    # removes every override at the end).
    def plug(extractor):
        app.dependency_overrides[get_job_extractor] = lambda: extractor
        return extractor

    return plug


def extract(client, text="Some job posting"):
    return client.post("/job-postings/extract", json={"text": text})


def test_extract_returns_the_fields(client, use_extractor):
    use_extractor(FakeJobExtractor(FULL_RESULT))

    response = extract(client)

    assert response.status_code == 200
    assert response.json() == {
        "company": "Acme",
        "position": "Backend Developer",
        "location": "Montreal",
        "deadline": "2026-12-15",
        "skills": ["Python", "PostgreSQL"],
    }


def test_extract_returns_null_for_missing_fields(client, use_extractor):
    use_extractor(FakeJobExtractor(EMPTY_RESULT))

    body = extract(client).json()

    assert body == {
        "company": None,
        "position": None,
        "location": None,
        "deadline": None,
        "skills": None,
    }


def test_extractor_receives_the_text_and_todays_date(client, use_extractor):
    fake = use_extractor(FakeJobExtractor(FULL_RESULT))

    extract(client, "Hiring a developer")

    assert fake.calls == [("Hiring a developer", date.today())]


def test_extract_saves_nothing(client, use_extractor, session):
    use_extractor(FakeJobExtractor(FULL_RESULT))

    extract(client)

    assert session.scalar(select(func.count()).select_from(Application)) == 0
    assert session.scalar(select(func.count()).select_from(Contact)) == 0


@pytest.mark.parametrize("text", ["", "   \n\t "])
def test_empty_or_blank_text_returns_422(client, use_extractor, text):
    fake = use_extractor(FakeJobExtractor(FULL_RESULT))

    assert extract(client, text).status_code == 422
    assert fake.calls == []  # the model is never called for invalid input


def test_missing_text_returns_422(client, use_extractor):
    use_extractor(FakeJobExtractor(FULL_RESULT))

    assert client.post("/job-postings/extract", json={}).status_code == 422


def test_text_of_20000_characters_is_accepted_and_20001_is_not(client, use_extractor):
    use_extractor(FakeJobExtractor(FULL_RESULT))

    assert extract(client, "x" * 20000).status_code == 200
    assert extract(client, "x" * 20001).status_code == 422


def test_model_failure_returns_502_without_details(client, use_extractor):
    use_extractor(FakeJobExtractor(error=ExtractionFailed("RateLimitError secret-detail")))

    response = extract(client)

    assert response.status_code == 502
    assert "secret-detail" not in response.text


def test_missing_api_key_returns_503(client, monkeypatch):
    # No fake here: the real dependency runs, with settings that have no key.
    settings = Settings(_env_file=None, database_url="unused", anthropic_api_key=None)
    monkeypatch.setattr("app.llm.get_settings", lambda: settings)

    response = extract(client)

    assert response.status_code == 503
    assert response.json() == {"detail": "AI extraction is not configured"}


def test_get_job_extractor_raises_without_key(monkeypatch):
    settings = Settings(_env_file=None, database_url="unused", anthropic_api_key="")
    monkeypatch.setattr("app.llm.get_settings", lambda: settings)

    with pytest.raises(ExtractionUnavailable):
        get_job_extractor()
