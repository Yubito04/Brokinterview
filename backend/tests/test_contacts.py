from datetime import UTC, datetime

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
    [error] = response.json()["detail"]
    assert error["type"] == "null_not_allowed"
    assert error["ctx"] == {"field": "name"}


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


# --- consistency of the two dates ---

EARLIER = "2026-10-30T08:00:00Z"


def only_error(response):
    assert response.status_code == 422
    [error] = response.json()["detail"]
    return error


def test_create_reply_without_contact_returns_422_on_replied_at(client):
    application = create_application(client)

    error = only_error(create_contact(client, application["id"], replied_at=REPLIED))

    assert error["type"] == "reply_without_contact"
    assert error["loc"] == ["body", "replied_at"]


def test_create_reply_before_contact_returns_422_on_replied_at(client):
    application = create_application(client)

    error = only_error(
        create_contact(client, application["id"], contacted_at=CONTACTED, replied_at=EARLIER)
    )

    assert error["type"] == "reply_before_contact"
    assert error["loc"] == ["body", "replied_at"]


def test_create_reply_at_the_same_instant_is_accepted(client):
    application = create_application(client)

    response = create_contact(
        client, application["id"], contacted_at=CONTACTED, replied_at=CONTACTED
    )

    assert response.status_code == 201
    assert response.json()["state"] == "REPLIED"


def test_create_dates_without_timezone_are_read_as_utc(client):
    application = create_application(client)

    same_instant = create_contact(
        client,
        application["id"],
        contacted_at="2026-11-01T10:00:00",
        replied_at="2026-11-01T10:00:00Z",
    )
    earlier = create_contact(
        client,
        application["id"],
        contacted_at="2026-11-01T10:00:00Z",
        replied_at="2026-11-01T09:59:59",
    )

    assert same_instant.status_code == 201
    assert only_error(earlier)["type"] == "reply_before_contact"


def test_create_with_an_invalid_contact_date_reports_only_that_date(client):
    application = create_application(client)

    error = only_error(
        create_contact(client, application["id"], contacted_at="abc", replied_at=REPLIED)
    )

    assert error["loc"] == ["body", "contacted_at"]


def test_patch_reply_before_the_saved_contact_date_returns_422(client):
    application = create_application(client)
    contact = create_contact(client, application["id"], contacted_at=CONTACTED).json()

    response = client.patch(f"/contacts/{contact['id']}", json={"replied_at": EARLIER})

    error = only_error(response)
    assert error["type"] == "reply_before_contact"
    assert error["loc"] == ["body", "replied_at"]


def test_patch_reply_on_a_contact_never_contacted_returns_422(client):
    application = create_application(client)
    contact = create_contact(client, application["id"]).json()

    response = client.patch(f"/contacts/{contact['id']}", json={"replied_at": REPLIED})

    assert only_error(response)["type"] == "reply_without_contact"


def test_patch_contact_date_moved_after_the_saved_reply_returns_422(client):
    application = create_application(client)
    contact = create_contact(
        client, application["id"], contacted_at=CONTACTED, replied_at=REPLIED
    ).json()

    response = client.patch(
        f"/contacts/{contact['id']}", json={"contacted_at": "2026-11-20T10:00:00Z"}
    )

    assert only_error(response)["type"] == "reply_before_contact"


def test_patch_clearing_the_contact_date_while_a_reply_remains_returns_422(client):
    application = create_application(client)
    contact = create_contact(
        client, application["id"], contacted_at=CONTACTED, replied_at=REPLIED
    ).json()

    response = client.patch(f"/contacts/{contact['id']}", json={"contacted_at": None})

    assert only_error(response)["type"] == "reply_without_contact"


def test_patch_clearing_both_dates_together_is_accepted(client):
    application = create_application(client)
    contact = create_contact(
        client, application["id"], contacted_at=CONTACTED, replied_at=REPLIED
    ).json()

    response = client.patch(
        f"/contacts/{contact['id']}", json={"contacted_at": None, "replied_at": None}
    )

    assert response.status_code == 200
    assert response.json()["state"] == "NOT_CONTACTED"


def test_patch_rejected_by_the_rule_changes_nothing(client):
    application = create_application(client)
    contact = create_contact(client, application["id"], contacted_at=CONTACTED).json()

    client.patch(f"/contacts/{contact['id']}", json={"name": "Bob", "replied_at": EARLIER})

    saved = client.get(f"/applications/{application['id']}/contacts").json()[0]
    assert saved["name"] == "Alice"
    assert saved["replied_at"] is None


def test_patch_that_touches_no_date_does_not_check_old_inconsistent_data(client, session):
    # A contact saved before the rule existed, with a reply and no contact date.
    from app.models import Contact

    application = create_application(client)
    legacy = Contact(
        application_id=application["id"],
        name="Legacy",
        replied_at=datetime(2026, 11, 3, tzinfo=UTC),
    )
    session.add(legacy)
    session.commit()

    response = client.patch(f"/contacts/{legacy.id}", json={"name": "Renamed"})

    assert response.status_code == 200
    assert response.json()["name"] == "Renamed"
