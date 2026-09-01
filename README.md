# Rail Block Planner Backend

Hackathon-ready backend for SIH26027: it turns maintenance tasks plus available corridor windows into a **draft** block plan. A planner reviews it, an authorised Senior DOM approves it, and only then can it be published.

## What is included

- FastAPI REST API with automatic interactive docs at `/docs`
- JWT login and role-based permissions: planner, department approver, Senior DOM, admin
- Canonical models for maintenance tasks, corridor block windows, plans, items and approvals
- Transparent 0-100 priority score: severity + overdue days + traffic density + failure history
- OR-Tools CP-SAT scheduler: section match, enough duration, one job per window, one crew per window
- Draft -> approved -> published workflow; the solver cannot auto-publish
- Docker setup and a focused priority-scoring test

## Important MVP boundary

This is a safe **MVP**, not a production railway control system. Real BDMS/COA write-back, interlocking/possession rules, geography, per-crew travel times, Kafka, Airflow and PostgreSQL/PostGIS adapters should be added after the railway provides their interfaces and safety rules. The publish endpoint deliberately contains no real external write-back client yet.

## Run locally

```powershell
cd outputs\rail-block-planner-backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

Open `http://localhost:8000/docs`. For Docker, run `docker compose up --build`.

## Frontend contract: normal flow

1. `POST /api/v1/auth/register` - create a demo account. Set an admin/Senior DOM role only for local demo purposes.
2. `POST /api/v1/auth/login` - get `access_token`; send `Authorization: Bearer <token>` on every later request.
3. `POST /api/v1/tasks` - send normalised TMS, SMMS or TDMS task data.
4. `POST /api/v1/windows` - send available COA/freight-safe windows.
5. `POST /api/v1/plans/generate` - receive a DRAFT plan and unscheduled task IDs.
6. `GET /api/v1/plans/{id}` - show items on a Gantt/corridor timeline.
7. `POST /api/v1/plans/{id}/approve` - Senior DOM (or admin) changes it to APPROVED.
8. `POST /api/v1/plans/{id}/publish` - changes it to PUBLISHED after approval.

## Example data

Create a planner/admin, login, then use the token in Swagger. Example task body:

```json
{
  "external_id": "TMS-1001",
  "department": "ENGG",
  "source": "TMS",
  "asset_id": "TRACK-77",
  "section_id": "NDLS-GZB-UP",
  "defect_type": "rail crack",
  "severity": 5,
  "raised_on": "2026-09-01T00:00:00Z",
  "due_by": "2026-09-03T00:00:00Z",
  "estimated_minutes": 90,
  "crew_id": "ENGG-CREW-2",
  "traffic_density": 85,
  "failure_history": 20
}
```

Matching window:

```json
{
  "external_id": "COA-901",
  "section_id": "NDLS-GZB-UP",
  "start_at": "2026-09-02T01:00:00Z",
  "end_at": "2026-09-02T03:00:00Z",
  "traffic_load": 10,
  "caution_ok": true
}
```

Then send `{ "horizon":"WEEK", "starts_at":"2026-09-01T00:00:00Z", "ends_at":"2026-09-08T00:00:00Z" }` to the generate endpoint.

## Upload to GitHub

Create an empty GitHub repository, then run these commands from this project folder (replace the URL):

```powershell
git add .
git commit -m "Initial Rail Block Planner backend"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/rail-block-planner-backend.git
git push -u origin main
```

## Project map

| Folder | Plain meaning |
| --- | --- |
| `app/api` | HTTP endpoints the frontend calls |
| `app/models` | Database tables and allowed states |
| `app/schemas` | Exact request/response formats |
| `app/services/scoring.py` | Explainable priority calculation; later replace with XGBoost + SHAP |
| `app/services/optimizer.py` | OR-Tools scheduling rules and objective |
| `app/core` | Settings, database connection, passwords and tokens |

## Production next steps

1. Change `DATABASE_URL` to PostgreSQL and enable PostGIS; use Alembic migrations.
2. Add one read-only connector per railway source (TMS, SMMS, TDMS, COA), then map each feed to these canonical entities.
3. Move planning runs to Celery workers with Redis; add Kafka for change events.
4. Add every safety constraint as a solver hard constraint and have railway safety staff test it.
5. Implement authenticated BDMS/COA clients only after approval. Store immutable audit logs and plan versions.
6. Once labelled outcomes exist, train/validate an ML model; keep its explanation and human approval compulsory.

## Test

```powershell
pytest
```
