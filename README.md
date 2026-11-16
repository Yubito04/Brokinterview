# ApplyFlow AI

A job application tracker with AI-assisted import: paste the text of a job posting, an LLM
extracts the fields, and you review them before anything is saved.

The interface is bilingual (French and English). It is a portfolio project: every decision is
written down in [`docs/adr/`](docs/adr/), and the known limits are listed honestly at the end of
this file.

## What it does

- **Track applications**: company, position, location, deadline and status (`APPLIED`,
  `INTERVIEW`, `OFFER`, `REJECTED`), with a filterable, searchable, paginated list.
- **Track contacts** for each application (who, when contacted, when they replied; the state is
  derived from the two dates).
- **Import a job posting**: the AI proposes the fields, marks what it did not find, and warns that
  what it filled in may be wrong. Nothing is saved until you review and create the application.
- **French and English**, switchable without reloading; errors from the API are translated from
  stable codes, never from the English message.

## Screenshots

> To add. Run `.venv\Scripts\python.exe -m scripts.seed_demo --reset` in `backend/` **before**
> taking them, so that every capture shows the same fictional data (`--reset` deletes every
> application and contact of the development database first: use it only on demo data).
> Save the files in `docs/images/` with the names below, then remove the comment marks around
> the image lines.

| File | What to show |
|------|--------------|
| `docs/images/01-list.png` | The list with a status filter and a search, in French |
| `docs/images/02-detail.png` | A detail page with its contacts (one replied, one waiting) |
| `docs/images/03-form-errors.png` | The creation form with the server's errors under two fields |
| `docs/images/04-import-review.png` | The import review: AI warning, a "not found in the posting" note, skills |
| `docs/images/05-delete-confirmation.png` | The confirmation that says how many contacts will be deleted |
| `docs/images/06-english.png` | The list in English (language selector visible) |
| `docs/images/import-flow.gif` | The import journey: paste, extract, correct a field, create |

<!--
![The list](docs/images/01-list.png)
![A detail page](docs/images/02-detail.png)
![Form errors](docs/images/03-form-errors.png)
![Import review](docs/images/04-import-review.png)
![Delete confirmation](docs/images/05-delete-confirmation.png)
![English interface](docs/images/06-english.png)
![Import journey](docs/images/import-flow.gif)
-->

## Architecture

```mermaid
flowchart LR
    Browser["Browser<br/>React + TypeScript (Vite)"] -- "JSON over HTTP" --> API["FastAPI<br/>backend/app"]
    API -- "SQLAlchemy + Alembic" --> DB[("PostgreSQL")]
    API -- "extraction only" --> LLM["Anthropic API<br/>Claude Haiku"]
```

| Part | Technology |
|------|------------|
| Backend | Python, FastAPI, Pydantic, SQLAlchemy, Alembic, PostgreSQL |
| Frontend | React, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router, i18next |
| AI | Anthropic API (`claude-haiku-5-5` by default), structured output |
| Tests | pytest (backend), Vitest and React Testing Library (frontend) |

```
backend/    API, models, migrations (alembic/), tests, seed script (scripts/)
frontend/   React app (src/), generated API types (src/api/schema.d.ts)
docs/       ADRs, learning log, interview preparation, backlog
```

The frontend types come from the API's own contract: `backend/openapi.json` is generated from the
code, a test fails if it is out of date, and `npm run check:api` fails if the frontend types are.

## Quick start (Windows)

**Prerequisites**: Python (tested with 3.15.2), Node.js (tested with 24.22.1) and a running
PostgreSQL.

**1. Clone into a short path** such as `C:\dev\applyflow-ai`. Windows refuses file paths over 260
characters, and some Python packages are deeply nested: from a very long folder, `pip install` fails
with `No such file or directory` (see Troubleshooting).

**2. Create two empty PostgreSQL databases**: `applyflow` (development) and `applyflow_test`
(tests only).

**3. Backend** (a fresh clone has no `.env` and no virtual environment):

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env
```

Now **edit `backend/.env`**: replace `USER:PASSWORD` in `DATABASE_URL` and `TEST_DATABASE_URL`
with your PostgreSQL user and password (the file is ignored by Git, never commit it). The test
database name must end with `_test` and differ from the development one: the test run drops its
tables at the end and refuses to start otherwise. `ANTHROPIC_API_KEY` is optional (see
[Environment variables](#environment-variables)). Then create the tables and start the API:

```powershell
.venv\Scripts\python.exe -m alembic upgrade head
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8765
```

The API is at http://127.0.0.1:8765 (interactive docs at `/docs`). `alembic upgrade head` brings
the schema up to date: **run it again after every new migration** (for example after pulling new
code), because a database that lacks a new column makes every request fail with a 500 error.

**4. Fictional demo data** (optional, in another terminal, from `backend/`):

```powershell
.venv\Scripts\python.exe -m scripts.seed_demo
```

It inserts 30 fictional applications and a few contacts. It refuses to run on a database whose name
ends with `_test`, and deletes nothing unless you add `--reset` (which deletes **every** application
and contact first).

**5. Frontend** (in another terminal):

```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```

Open **http://localhost:5173** (not `127.0.0.1`: Vite listens on IPv6 `::1` on the development
machine). The backend must be running. `frontend/.env` only holds `VITE_API_URL`, which is public
(copied into the browser code): never put a secret in it. Details in
[`frontend/README.md`](frontend/README.md).

## Environment variables

`backend/.env` (copy of `backend/.env.example`):

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | yes | Development database, `postgresql+psycopg://USER:PASSWORD@localhost:5432/applyflow` |
| `TEST_DATABASE_URL` | for the tests | Test database; the name must end with `_test` and differ from the one above |
| `ANTHROPIC_API_KEY` | no | Without it the app runs and only `POST /job-postings/extract` answers 503. Create a key on console.anthropic.com. |
| `ANTHROPIC_MODEL` | no | Model used by the extraction (default `claude-haiku-5-5`) |
| `CORS_ORIGINS` | no | Origins allowed to call the API from a browser, comma-separated. Default: `http://localhost:5173` and `http://127.0.0.1:5173`. See [ADR 007](docs/adr/007-cors-pour-le-frontend.md). |

`frontend/.env`: `VITE_API_URL` (default `http://127.0.0.1:8765`).

## Run the tests

```powershell
# Backend (from backend/): 159 tests at the time of writing
.venv\Scripts\python.exe -m pytest

# Frontend (from frontend/): 326 tests at the time of writing
npm run test
npm run lint
npm run build        # type-check and production build
npm run check:api    # fails if src/api/schema.d.ts is out of date with backend/openapi.json
```

The backend tests use the real PostgreSQL test database. At the start of a run it is emptied and
rebuilt with the real Alembic migrations, so tests use the same schema as production; at the end the
migrations are downgraded. Each test runs in a transaction that is rolled back, so tests never see
each other's data. `tests/test_migrations.py` checks that models and migrations are in sync and that
upgrade, downgrade, upgrade works (including the PostgreSQL enum type). No test calls the real AI
model by default (see [AI extraction](#ai-extraction-of-job-postings)).

## Troubleshooting

| Symptom | Cause and fix |
|---------|---------------|
| Every API request answers 500, and the page says the API is unreachable | The development database is missing a migration. Run `alembic upgrade head` in `backend/`. |
| `pip install` fails with `No such file or directory` and a hint about long paths | The project is in a folder with a very long path. Clone it into a short one (`C:\dev`), or enable Windows long paths. |
| `ERR_CONNECTION_REFUSED` on http://127.0.0.1:5173 | Use http://localhost:5173: Vite listens on IPv6 `::1` there. |
| uvicorn cannot listen on port 8000 (error 10013) | Windows reserves some port ranges. Any free port works: change `--port`. |
| The tests refuse to start | `TEST_DATABASE_URL` must be set, end with `_test`, and differ from `DATABASE_URL`. |
| The import screen answers "service not available" | No `ANTHROPIC_API_KEY` in `backend/.env`. |

## API

Interactive documentation is served at `/docs` while the API runs. The API's contract is
`backend/openapi.json`.

### Data model

Defined in `backend/app/models.py` (SQLAlchemy):

- `applications`: `id`, `company`, `position`, `location` (optional), `deadline` (optional date), `status` (`APPLIED`, `INTERVIEW`, `OFFER`, `REJECTED`), `created_at`.
- `contacts`: `id`, `application_id` (foreign key), `name`, `contacted_at`, `replied_at`, `created_at`.
  The contact state (`NOT_CONTACTED`, `WAITING`, `REPLIED`) is derived from the two dates, not stored.

One application has many contacts; deleting an application deletes its contacts.

### Endpoints

| Method | Path                                   | Description                                  |
|--------|----------------------------------------|----------------------------------------------|
| GET    | `/health`                              | Health check                                 |
| POST   | `/applications`                        | Create an application (201)                  |
| GET    | `/applications`                        | List applications (paginated, see below)     |
| GET    | `/applications/{id}`                   | Read one application (404 if unknown)        |
| PATCH  | `/applications/{id}`                   | Partial update                               |
| DELETE | `/applications/{id}`                   | Delete it and its contacts (204)             |
| POST   | `/applications/{id}/contacts`          | Add a contact to an application (201)        |
| GET    | `/applications/{id}/contacts`          | List the contacts of an application          |
| PATCH  | `/contacts/{id}`                       | Partial update of a contact                  |
| DELETE | `/contacts/{id}`                       | Delete a contact (204)                       |
| POST   | `/job-postings/extract`                | Extract fields from a job posting with an LLM (nothing saved) |

**Listing.** `GET /applications` accepts these query parameters:

| Parameter | Default | Rule |
|-----------|---------|------|
| `limit`   | 20      | 1 to 100, otherwise 422 |
| `offset`  | 0       | 0 or more, otherwise 422 |
| `status`  | none    | one of `APPLIED`, `INTERVIEW`, `OFFER`, `REJECTED`, otherwise 422 |
| `q`       | none    | text searched (case-insensitive) in company or position, max 200 characters; blank is ignored |

Results are sorted newest first (`created_at`, then `id`, both descending), so pages never
overlap. The response is an envelope:

```json
{ "items": [ { "id": 7, "company": "Acme", "position": "Backend Developer",
               "status": "APPLIED", "created_at": "2026-11-08T14:00:43-05:00" } ],
  "total": 137, "limit": 20, "offset": 0 }
```

`total` counts all rows matching the filters, not only the rows of the page.

**PATCH rule.** A field left out is not changed. `null` on a required field
(`company`, `position`, `status`, contact `name`) returns 422 with the code `null_not_allowed`.
`null` on an optional field (`location`, `deadline`, `contacted_at`, `replied_at`) clears it.

**Contact dates.** A reply cannot come without a contact date (`reply_without_contact`) nor before
it (`reply_before_contact`), both 422. A date sent without a timezone is read as UTC. On a
`PATCH`, the rule is checked on the merged state (the saved dates plus the ones sent), and only
when the request touches one of the two dates. See
[ADR 011](docs/adr/011-detail-contacts-et-suppression.md).

**Errors.** Validation errors (422) carry a stable `type` code, and the frontend translates from
that code, never from the English message.

### AI extraction of job postings

`POST /job-postings/extract` takes `{"text": "<job posting>"}` (1 to 20,000 characters) and
returns the fields found by Claude Haiku. Nothing is saved: check the result, then create
the application with `POST /applications`.

```json
{ "company": "Acme", "position": "Backend Developer", "location": "Montreal",
  "deadline": "2026-12-15", "skills": ["Python", "PostgreSQL"] }
```

`company`, `position`, `location` and `deadline` are `null` when the posting does not say.
`skills` only holds technical skills (languages, frameworks, tools, platforms) and is an
empty list `[]`, never `null`, when there are none. It is returned but not stored (no
column yet).

| Status | Meaning |
|--------|---------|
| 422    | Text missing, blank (`text_blank`) or longer than 20,000 characters |
| 502    | The model call failed or gave an unusable answer |
| 503    | No `ANTHROPIC_API_KEY` configured |
| 504    | The model took too long (the API's budget is about 41 seconds at worst) |

The model can be wrong, and the posting is untrusted text (it may contain instructions aimed at
the model). That is why the screen shows the result for review and saves nothing by itself. The
evaluation on real postings is in [ADR 006](docs/adr/006-extraction-d-offres-par-llm.md).

By default the tests use a fake extractor and a mocked HTTP layer: no network, no cost. Two tests
call the real model and run only on request:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest -m live_llm
```

## Frontend notes

- **Languages.** The language is the user's choice from the selector (kept in `localStorage`, key
  `applyflow.lang`), otherwise the browser's, otherwise English. Texts live in
  `frontend/src/i18n/fr.ts` (the reference) and `en.ts`; a test fails if their keys or
  `{{variables}}` differ. To add a text: add the key to both dictionaries and use `useT()`. See
  [ADR 009](docs/adr/009-interface-bilingue-i18n.md).
- **Forms.** The form validates nothing itself: the API's 422 answers are shown, translated, under
  each field (the browser's validation bubbles are off with `noValidate`, because they would use
  the browser's language). An edit sends only the fields that changed. See
  [ADR 010](docs/adr/010-formulaire-de-candidature.md).
- **Detail page and contacts.** `/applications/:id` shows an application and its contacts; contacts
  are added, edited and deleted in place. Deleting an application asks first and says how many
  contacts go with it. See [ADR 011](docs/adr/011-detail-contacts-et-suppression.md).
- **Import.** `/applications/import`: the AI's answer goes into the creation form for review.
  Fields it did not find are marked, the filled ones come with a warning (the position and the
  deadline are the ones to double-check), and a new extraction asks before replacing hand-made
  corrections. See [ADR 012](docs/adr/012-ecran-d-import-d-offre.md).
- **Why this stack.** [ADR 008](docs/adr/008-choix-techniques-du-frontend.md).

## Known limits

This project is not ready to be exposed on the internet. In short:

- **No authentication and no rate limit.** Anyone who can reach the API can read and change the
  data, and spend the Anthropic key by calling the extraction (each call costs money). Do not
  deploy publicly. The deployment plan is proposed in
  [ADR 013](docs/adr/013-deploiement-et-securite.md) (status: proposed).
- **The AI can be wrong**, and the evaluation (4 postings, 3 runs each) is too small to give a
  success rate. The review before creating is the safeguard.
- **The posting text is sent to an AI service**, which the import screen says before sending.
- **Extracted skills are not stored** (no column yet).
- **Accessibility is checked with automated tests by role and name, not with a real screen
  reader.**
- **The date and time pickers of the browser follow the browser's language**, not the app's.
- One frontend test failed once without a demonstrated cause (see the backlog).

The full list of improvements is in [`docs/backlog.md`](docs/backlog.md).

## Documentation

- Architecture decisions: [`docs/adr/`](docs/adr/) (index in [`docs/adr/README.md`](docs/adr/README.md)).
- Concepts learned: [`docs/learning-log.md`](docs/learning-log.md).
- Interview preparation: [`docs/interview-prep.md`](docs/interview-prep.md).
- Backlog: [`docs/backlog.md`](docs/backlog.md).

The documentation in `docs/` is written in French; this README and the code are in English.

## License

[MIT](LICENSE).
