# claimforge-api

FastAPI service for ClaimForge.

## Setup

```bash
python -m venv .venv
. .venv/bin/activate              # Windows: .venv\Scripts\activate
pip install -r requirements-dev.lock
pip install -e . --no-deps
```

## Run

```bash
uvicorn claimforge_api.main:app --reload    # http://localhost:8000/docs
```

## Database migrations

Schema changes are managed with Alembic. Models live in `claimforge_api.db`; every
model module must be imported in `db/registry.py`.

```bash
just db-revision "add claims table"   # autogenerate from model changes, then review it
just db-upgrade                       # apply all migrations
just db-downgrade                     # roll back one step
```

The test suite runs every migration up, down and up again, and fails if the models
and migrations drift apart.

## Dependencies

Dependencies are declared in `pyproject.toml` and pinned with pip-tools:

```bash
pip-compile -o requirements.lock pyproject.toml
pip-compile --extra dev -o requirements-dev.lock pyproject.toml
```
