from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_application_defaults_status_to_applied():
    response = client.post(
        "/applications", json={"company": "Acme", "position": "Backend Developer"}
    )

    assert response.status_code == 201
    assert response.json() == {
        "company": "Acme",
        "position": "Backend Developer",
        "status": "APPLIED",
    }


def test_create_application_keeps_explicit_status():
    response = client.post(
        "/applications",
        json={"company": "Acme", "position": "Backend Developer", "status": "INTERVIEW"},
    )

    assert response.status_code == 201
    assert response.json()["status"] == "INTERVIEW"


def test_create_application_missing_company_returns_422():
    response = client.post("/applications", json={"position": "Backend Developer"})

    assert response.status_code == 422


def test_create_application_missing_position_returns_422():
    response = client.post("/applications", json={"company": "Acme"})

    assert response.status_code == 422
