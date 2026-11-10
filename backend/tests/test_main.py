import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app


def test_health_returns_ok():
    response = TestClient(app).get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def preflight(origin: str, method: str = "PATCH"):
    # The browser sends this OPTIONS request first, to ask "may I?".
    return TestClient(app).options(
        "/applications/1",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": method,
            "Access-Control-Request-Headers": "content-type",
        },
    )


@pytest.mark.parametrize("origin", ["http://localhost:5173", "http://127.0.0.1:5173"])
def test_frontend_origins_are_allowed_by_default(origin):
    # localhost and 127.0.0.1 are two different origins: each one must be listed.
    assert origin in Settings(_env_file=None, database_url="x").cors_origin_list


def test_preflight_from_an_allowed_origin_is_accepted():
    origin = get_settings().cors_origin_list[0]

    response = preflight(origin)

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert "PATCH" in response.headers["access-control-allow-methods"]


def test_preflight_from_an_unknown_origin_is_refused():
    response = preflight("http://evil.example")

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_simple_request_from_an_unknown_origin_gets_no_cors_header():
    response = TestClient(app).get("/health", headers={"Origin": "http://evil.example"})

    assert response.status_code == 200  # the server answers; the browser would block it
    assert "access-control-allow-origin" not in response.headers


def test_cors_origins_come_from_the_environment(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", " https://a.example , https://b.example ,")

    settings = Settings(_env_file=None, database_url="x")

    assert settings.cors_origin_list == ["https://a.example", "https://b.example"]
