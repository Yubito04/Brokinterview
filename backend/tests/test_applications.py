def create_application(client, **overrides):
    payload = {"company": "Acme", "position": "Backend Developer", **overrides}
    return client.post("/applications", json=payload)


# --- POST /applications ---


def test_create_returns_201_with_generated_fields(client):
    response = create_application(client)

    assert response.status_code == 201
    body = response.json()
    assert body["company"] == "Acme"
    assert body["position"] == "Backend Developer"
    assert body["status"] == "APPLIED"
    assert isinstance(body["id"], int)
    assert body["created_at"]


def test_create_keeps_explicit_status(client):
    response = create_application(client, status="INTERVIEW")

    assert response.status_code == 201
    assert response.json()["status"] == "INTERVIEW"


def test_create_missing_company_returns_422(client):
    response = client.post("/applications", json={"position": "Backend Developer"})

    assert response.status_code == 422


def test_create_missing_position_returns_422(client):
    response = client.post("/applications", json={"company": "Acme"})

    assert response.status_code == 422


def test_create_unknown_status_returns_422(client):
    assert create_application(client, status="BANANA").status_code == 422


def test_create_empty_company_returns_422(client):
    assert create_application(client, company="").status_code == 422


def test_create_too_long_company_returns_422(client):
    assert create_application(client, company="x" * 201).status_code == 422


def test_client_cannot_choose_the_id(client):
    first = create_application(client).json()

    forced = create_application(client, id=999999).json()

    assert forced["id"] != 999999
    assert forced["id"] != first["id"]


# --- GET /applications ---


def test_list_is_empty_at_the_start_of_each_test(client):
    # Proves the rollback isolation: other tests created applications before.
    body = client.get("/applications").json()

    assert body["items"] == []
    assert body["total"] == 0


def test_list_returns_newest_application_first(client):
    create_application(client, company="First")
    create_application(client, company="Second")

    companies = [a["company"] for a in client.get("/applications").json()["items"]]

    assert companies == ["Second", "First"]


# --- GET /applications/{id} ---


def test_read_returns_the_application(client):
    created = create_application(client).json()

    response = client.get(f"/applications/{created['id']}")

    assert response.status_code == 200
    assert response.json() == created


def test_read_unknown_id_returns_404(client):
    assert client.get("/applications/999999").status_code == 404


def test_read_non_integer_id_returns_422(client):
    assert client.get("/applications/abc").status_code == 422


# --- PATCH /applications/{id} ---


def test_patch_changes_only_the_fields_sent(client):
    created = create_application(client).json()

    response = client.patch(f"/applications/{created['id']}", json={"status": "OFFER"})

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "OFFER"
    assert body["company"] == "Acme"
    assert body["position"] == "Backend Developer"


def test_patch_with_empty_body_changes_nothing(client):
    created = create_application(client).json()

    response = client.patch(f"/applications/{created['id']}", json={})

    assert response.status_code == 200
    assert response.json() == created


def test_patch_is_really_saved(client):
    created = create_application(client).json()
    client.patch(f"/applications/{created['id']}", json={"company": "NewCo"})

    assert client.get(f"/applications/{created['id']}").json()["company"] == "NewCo"


def test_patch_null_on_required_field_returns_422(client):
    created = create_application(client).json()

    for field in ("company", "position", "status"):
        response = client.patch(f"/applications/{created['id']}", json={field: None})
        assert response.status_code == 422, field


def test_patch_unknown_status_returns_422(client):
    created = create_application(client).json()

    response = client.patch(f"/applications/{created['id']}", json={"status": "BANANA"})

    assert response.status_code == 422


def test_patch_unknown_id_returns_404(client):
    assert client.patch("/applications/999999", json={"status": "OFFER"}).status_code == 404


# --- DELETE /applications/{id} ---


def test_delete_returns_204_then_application_is_gone(client):
    created = create_application(client).json()

    response = client.delete(f"/applications/{created['id']}")

    assert response.status_code == 204
    assert response.content == b""
    assert client.get(f"/applications/{created['id']}").status_code == 404


def test_delete_unknown_id_returns_404(client):
    assert client.delete("/applications/999999").status_code == 404
