CONTACTED = "2026-11-01T10:00:00Z"
REPLIED = "2026-11-03T15:30:00Z"


def create_application(client):
    return client.post(
        "/applications", json={"company": "Acme", "position": "Backend Developer"}
    ).json()


def create_contact(client, application_id, **fields):
    payload = {"name": "Alice", **fields}
    return client.post(f"/applications/{application_id}/contacts", json=payload)


# --- POST /applications/{id}/contacts ---


def test_create_contact_without_dates_is_not_contacted(client):
    application = create_application(client)

    response = create_contact(client, application["id"])

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Alice"
    assert body["application_id"] == application["id"]
    assert body["contacted_at"] is None
    assert body["replied_at"] is None
    assert body["state"] == "NOT_CONTACTED"
    assert body["created_at"]


def test_create_contact_with_contacted_date_is_waiting(client):
    application = create_application(client)

    body = create_contact(client, application["id"], contacted_at=CONTACTED).json()

    assert body["state"] == "WAITING"


def test_create_contact_with_both_dates_is_replied(client):
    application = create_application(client)

    body = create_contact(
        client, application["id"], contacted_at=CONTACTED, replied_at=REPLIED
    ).json()

    assert body["state"] == "REPLIED"


def test_create_contact_unknown_application_returns_404(client):
    assert create_contact(client, 999999).status_code == 404


def test_create_contact_missing_name_returns_422(client):
    application = create_application(client)

    response = client.post(f"/applications/{application['id']}/contacts", json={})

    assert response.status_code == 422


def test_create_contact_invalid_date_returns_422(client):
    application = create_application(client)

    response = create_contact(client, application["id"], contacted_at="not a date")

    assert response.status_code == 422


# --- GET /applications/{id}/contacts ---


def test_list_contacts_returns_only_this_applications_contacts(client):
    first = create_application(client)
    second = create_application(client)
    create_contact(client, first["id"], name="Alice")
    create_contact(client, first["id"], name="Bob")
    create_contact(client, second["id"], name="Carol")

    response = client.get(f"/applications/{first['id']}/contacts")

    assert [c["name"] for c in response.json()] == ["Alice", "Bob"]


def test_list_contacts_unknown_application_returns_404(client):
    assert client.get("/applications/999999/contacts").status_code == 404


# --- PATCH /contacts/{id} ---


def test_patch_contact_sets_dates_and_state_follows(client):
    application = create_application(client)
    contact = create_contact(client, application["id"]).json()

    waiting = client.patch(f"/contacts/{contact['id']}", json={"contacted_at": CONTACTED})
    replied = client.patch(f"/contacts/{contact['id']}", json={"replied_at": REPLIED})

    assert waiting.json()["state"] == "WAITING"
    assert replied.json()["state"] == "REPLIED"


def test_patch_contact_null_date_clears_it(client):
    application = create_application(client)
    contact = create_contact(
        client, application["id"], contacted_at=CONTACTED, replied_at=REPLIED
    ).json()

    response = client.patch(f"/contacts/{contact['id']}", json={"replied_at": None})

    assert response.status_code == 200
    assert response.json()["replied_at"] is None
    assert response.json()["state"] == "WAITING"


def test_patch_contact_omitted_date_is_kept(client):
    application = create_application(client)
    contact = create_contact(client, application["id"], contacted_at=CONTACTED).json()

    response = client.patch(f"/contacts/{contact['id']}", json={"name": "Alicia"})

    body = response.json()
    assert body["name"] == "Alicia"
    assert body["contacted_at"] is not None
    assert body["state"] == "WAITING"


def test_patch_contact_null_name_returns_422(client):
    application = create_application(client)
    contact = create_contact(client, application["id"]).json()

    response = client.patch(f"/contacts/{contact['id']}", json={"name": None})

    assert response.status_code == 422


def test_patch_contact_unknown_id_returns_404(client):
    assert client.patch("/contacts/999999", json={"name": "X"}).status_code == 404


# --- DELETE /contacts/{id} ---


def test_delete_contact_returns_204_and_keeps_the_application(client):
    application = create_application(client)
    contact = create_contact(client, application["id"]).json()

    response = client.delete(f"/contacts/{contact['id']}")

    assert response.status_code == 204
    assert client.get(f"/applications/{application['id']}/contacts").json() == []
    assert client.get(f"/applications/{application['id']}").status_code == 200


def test_delete_contact_unknown_id_returns_404(client):
    assert client.delete("/contacts/999999").status_code == 404


# --- Cascade ---


def test_deleting_an_application_deletes_its_contacts(client):
    application = create_application(client)
    contact = create_contact(client, application["id"]).json()

    client.delete(f"/applications/{application['id']}")

    assert client.patch(f"/contacts/{contact['id']}", json={"name": "X"}).status_code == 404
