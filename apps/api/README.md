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
uvicorn claimforge_api.main:create_production_app --factory --reload   # :8000/docs
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

## File storage

Photos and documents go through `claimforge_api.storage`, which hides the backend:

- `local` (default): files under `CLAIMFORGE_STORAGE_LOCAL_ROOT`; the API serves the
  signed upload and download links itself.
- `s3`: an S3 bucket. Locally that's SeaweedFS from `compose.yaml`: set
  `CLAIMFORGE_STORAGE_BACKEND=s3` and the `CLAIMFORGE_S3_*` values from `.env.example`.
  Presigned links go straight to the bucket.

```bash
just storage-init   # create the bucket (or directories) and allow the web apps' origins
```

`/readyz` reports storage as well as the database.

## Background worker

Photo thumbnails and previews are made outside requests, and abandoned uploads are cleaned
up, by a worker using the same settings as the API:

```bash
just worker          # runs until Ctrl+C / SIGTERM; run several to share the load
just worker --once   # process what's due, clean up, and exit
```

Photos stay `processing: "pending"` (no thumbnail links) until a worker has run.

## Dependencies

Dependencies are declared in `pyproject.toml` and pinned with pip-tools:

```bash
pip-compile -o requirements.lock pyproject.toml
pip-compile --extra dev -o requirements-dev.lock pyproject.toml
```
