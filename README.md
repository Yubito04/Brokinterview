# ApplyFlow AI

Job application tracker with LLM-based job posting extraction (work in progress).

## Stack

- Backend: Python, FastAPI, Pydantic, SQLAlchemy, PostgreSQL (Alembic planned)
- Frontend: React + TypeScript (planned)
- Tests: pytest

## Setup (Windows)

1. Create two empty PostgreSQL databases: `applyflow` (development) and
   `applyflow_test` (tests only).
2. Copy `backend/.env.example` to `backend/.env` and put your real password in it.
   The `.env` file is ignored by Git.

The `.env` file is found from the location of the code, so commands can be run
from any folder. The test database name must end with `_test` and differ from the
development one: the test run refuses to start otherwise, because it drops tables
at the end.

## Run the backend

```powershell
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8765
```

The API is then available at http://127.0.0.1:8765 (interactive docs at `/docs`).

**Why port 8765?** On the development machine Windows refuses to let the app listen
on the default port 8000 (error 10013, "access forbidden", usually a port range
reserved by the system). Any free port works; change `--port` if 8765 is taken.

The database tables do not exist yet in `applyflow`: they will be created by the
first Alembic migration. Until then, the routes that use the database only work in
the tests.

## Run the tests

```powershell
cd backend
.venv\Scripts\python.exe -m pytest
```

Route tests use the real PostgreSQL test database. Tables are created once per run;
each test runs in a transaction that is rolled back at the end, so tests never see
each other's data.

## Data model

Defined in `backend/app/models.py` (SQLAlchemy):

- `applications`: `id`, `company`, `position`, `status` (`APPLIED`, `INTERVIEW`, `OFFER`, `REJECTED`), `created_at`.
- `contacts`: `id`, `application_id` (foreign key), `name`, `contacted_at`, `replied_at`, `created_at`.
  The contact state (`NOT_CONTACTED`, `WAITING`, `REPLIED`) is derived from the two dates, not stored.

One application has many contacts; deleting an application deletes its contacts.

## Endpoints

| Method | Path                                   | Description                                  |
|--------|----------------------------------------|----------------------------------------------|
| GET    | `/health`                              | Health check                                 |
| POST   | `/applications`                        | Create an application (201)                  |
| GET    | `/applications`                        | List applications                            |
| GET    | `/applications/{id}`                   | Read one application (404 if unknown)        |
| PATCH  | `/applications/{id}`                   | Partial update                               |
| DELETE | `/applications/{id}`                   | Delete it and its contacts (204)             |
| POST   | `/applications/{id}/contacts`          | Add a contact to an application (201)        |
| GET    | `/applications/{id}/contacts`          | List the contacts of an application          |
| PATCH  | `/contacts/{id}`                       | Partial update of a contact                  |
| DELETE | `/contacts/{id}`                       | Delete a contact (204)                       |

**PATCH rule.** A field left out is not changed. `null` on a required field
(`company`, `position`, `status`, contact `name`) returns 422. `null` on an optional
field (`contacted_at`, `replied_at`) clears it.

## Documentation

Architecture decisions are recorded in [`docs/adr/`](docs/adr/).
Concepts learned: [`docs/learning-log.md`](docs/learning-log.md).
Interview questions: [`docs/interview-prep.md`](docs/interview-prep.md).
