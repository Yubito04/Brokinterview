# ApplyFlow AI

Job application tracker with LLM-based job posting extraction (work in progress).

## Stack

- Backend: Python, FastAPI, Pydantic (SQLAlchemy, Alembic, PostgreSQL planned)
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

## Endpoints

| Method | Path            | Description                          |
|--------|-----------------|--------------------------------------|
| GET    | `/health`       | Health check                         |
| POST   | `/applications` | Create an application (not stored yet) |

## Documentation

Architecture decisions are recorded in [`docs/adr/`](docs/adr/).
