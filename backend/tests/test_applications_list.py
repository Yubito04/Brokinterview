from datetime import datetime, timedelta, timezone

import pytest

from app.models import Application, ApplicationStatus

START = datetime(2026, 11, 1, 12, 0, tzinfo=timezone.utc)


def add_applications(session, count, **fields):
    # Insert straight into the test session, with distinct creation dates:
    # application number 0 is the oldest, the last one is the newest.
    applications = [
        Application(
            company=f"Company {i:02d}",
            position="Developer",
            created_at=START + timedelta(minutes=i),
            **fields,
        )
        for i in range(count)
    ]
    session.add_all(applications)
    session.flush()
    return applications


def companies(client, **params):
    return [a["company"] for a in client.get("/applications", params=params).json()["items"]]


# --- Response shape and pagination ---


def test_list_returns_an_envelope_with_default_limit(client, session):
    add_applications(session, 3)

    body = client.get("/applications").json()

    assert set(body) == {"items", "total", "limit", "offset"}
    assert body["total"] == 3
    assert body["limit"] == 20
    assert body["offset"] == 0
    assert len(body["items"]) == 3


def test_limit_and_offset_select_a_slice(client, session):
    add_applications(session, 10)

    # Newest first: Company 09, 08, 07, ...
    assert companies(client, limit=3, offset=0) == ["Company 09", "Company 08", "Company 07"]
    assert companies(client, limit=3, offset=3) == ["Company 06", "Company 05", "Company 04"]


def test_last_page_can_be_partial(client, session):
    add_applications(session, 5)

    body = client.get("/applications", params={"limit": 3, "offset": 3}).json()

    assert len(body["items"]) == 2
    assert body["total"] == 5


def test_offset_beyond_the_end_gives_an_empty_page_and_the_real_total(client, session):
    add_applications(session, 5)

    body = client.get("/applications", params={"offset": 100}).json()

    assert body["items"] == []
    assert body["total"] == 5


def test_walking_all_pages_returns_every_row_once(client, session):
    add_applications(session, 45)

    seen = []
    for offset in (0, 20, 40):
        page = client.get("/applications", params={"limit": 20, "offset": offset}).json()
        seen += [a["id"] for a in page["items"]]

    assert len(seen) == 45
    assert len(set(seen)) == 45


# --- Stable ordering ---


def test_same_creation_date_is_ordered_by_id_descending(client, session):
    # Two rows created at exactly the same instant: only the id can tell them apart.
    first = Application(company="Twin A", position="Dev", created_at=START)
    second = Application(company="Twin B", position="Dev", created_at=START)
    session.add_all([first, second])
    session.flush()
    assert first.created_at == second.created_at
    assert first.id < second.id

    ids = [a["id"] for a in client.get("/applications").json()["items"]]

    assert ids == [second.id, first.id]


def test_pages_do_not_overlap_when_dates_are_identical(client, session):
    session.add_all(
        [Application(company=f"Same {i}", position="Dev", created_at=START) for i in range(6)]
    )
    session.flush()

    pages = [
        client.get("/applications", params={"limit": 2, "offset": offset}).json()["items"]
        for offset in (0, 2, 4)
    ]
    ids = [a["id"] for page in pages for a in page]

    assert len(ids) == 6
    assert len(set(ids)) == 6
    assert ids == sorted(ids, reverse=True)


# --- Filter by status ---


def test_filter_by_status(client, session):
    add_applications(session, 2, status=ApplicationStatus.APPLIED)
    session.add(Application(company="Interview Co", position="Dev", status=ApplicationStatus.INTERVIEW))
    session.flush()

    body = client.get("/applications", params={"status": "INTERVIEW"}).json()

    assert [a["company"] for a in body["items"]] == ["Interview Co"]
    assert body["total"] == 1


def test_unknown_status_returns_422(client):
    assert client.get("/applications", params={"status": "BANANA"}).status_code == 422


# --- Search with q ---


def test_search_is_case_insensitive_and_matches_the_company(client, session):
    session.add_all(
        [
            Application(company="Acme", position="Dev"),
            Application(company="Globex", position="Dev"),
        ]
    )
    session.flush()

    assert companies(client, q="acme") == ["Acme"]
    assert companies(client, q="CME") == ["Acme"]


def test_search_also_matches_the_position(client, session):
    session.add_all(
        [
            Application(company="Acme", position="Backend Developer"),
            Application(company="Globex", position="Designer"),
        ]
    )
    session.flush()

    assert companies(client, q="backend") == ["Acme"]


def test_search_and_status_are_combined_and_total_follows_the_filters(client, session):
    session.add_all(
        [
            Application(company="Acme", position="Dev", status=ApplicationStatus.INTERVIEW),
            Application(company="Acme Labs", position="Dev", status=ApplicationStatus.APPLIED),
            Application(company="Globex", position="Dev", status=ApplicationStatus.INTERVIEW),
        ]
    )
    session.flush()

    body = client.get("/applications", params={"q": "acme", "status": "INTERVIEW"}).json()

    assert [a["company"] for a in body["items"]] == ["Acme"]
    assert body["total"] == 1


def test_total_counts_all_matches_not_only_the_page(client, session):
    add_applications(session, 12)

    body = client.get("/applications", params={"q": "company", "limit": 5}).json()

    assert len(body["items"]) == 5
    assert body["total"] == 12


@pytest.mark.parametrize("blank", ["", "   "])
def test_blank_search_is_ignored(client, session, blank):
    add_applications(session, 3)

    assert client.get("/applications", params={"q": blank}).json()["total"] == 3


@pytest.mark.parametrize(
    "wildcard, expected",
    [
        ("%", "100% Remote"),
        ("_", "a_b Corp"),
        ("\\", "Back\\slash Inc"),
    ],
)
def test_search_wildcards_are_matched_literally(client, session, wildcard, expected):
    # Without escaping, % would match every row and _ any single character.
    session.add_all(
        [
            Application(company="100% Remote", position="Dev"),
            Application(company="a_b Corp", position="Dev"),
            Application(company="Back\\slash Inc", position="Dev"),
            Application(company="Acme", position="Dev"),
        ]
    )
    session.flush()

    assert companies(client, q=wildcard) == [expected]


def test_search_text_is_never_run_as_sql(client, session):
    add_applications(session, 2)

    response = client.get("/applications", params={"q": "'; DROP TABLE applications; --"})

    assert response.status_code == 200
    assert response.json()["items"] == []
    assert client.get("/applications").json()["total"] == 2


# --- Parameter validation ---


@pytest.mark.parametrize(
    "params",
    [
        {"limit": 0},
        {"limit": -1},
        {"limit": 101},
        {"limit": "abc"},
        {"offset": -1},
        {"offset": "abc"},
        {"q": "x" * 201},
    ],
)
def test_invalid_query_parameters_return_422(client, params):
    assert client.get("/applications", params=params).status_code == 422


@pytest.mark.parametrize("limit", [1, 100])
def test_limit_bounds_are_accepted(client, limit):
    assert client.get("/applications", params={"limit": limit}).status_code == 200
