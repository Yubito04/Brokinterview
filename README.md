# ApplyFlow AI

Job application tracker with LLM-based job posting extraction (work in progress).

## Stack

- Backend: Python, FastAPI, Pydantic, SQLAlchemy (Alembic, PostgreSQL connection planned)
- Frontend: React + TypeScript (planned)
- Tests: pytest

## Run the backend (Windows)

```powershell
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

The API is then available at http://127.0.0.1:8000 (interactive docs at `/docs`).

## Run the tests

```powershell
cd backend
.venv\Scripts\python.exe -m pytest
```

## Data model

Defined in `backend/app/models.py` (SQLAlchemy):

- `applications`: `id`, `company`, `position`, `status` (`APPLIED`, `INTERVIEW`, `OFFER`, `REJECTED`), `created_at`.
- `contacts`: `id`, `application_id` (foreign key), `name`, `contacted_at`, `replied_at`, `created_at`.
  The contact state (`NOT_CONTACTED`, `WAITING`, `REPLIED`) is derived from the two dates, not stored.

One application has many contacts; deleting an application deletes its contacts.
Not yet connected to the API, and no Alembic migration yet.

## Endpoints

| Method | Path            | Description                          |
|--------|-----------------|--------------------------------------|
| GET    | `/health`       | Health check                         |
| POST   | `/applications` | Create an application (not stored yet) |

## Documentation

Architecture decisions are recorded in [`docs/adr/`](docs/adr/).
