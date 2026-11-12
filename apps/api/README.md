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

## Dependencies

Dependencies are declared in `pyproject.toml` and pinned with pip-tools:

```bash
pip-compile -o requirements.lock pyproject.toml
pip-compile --extra dev -o requirements-dev.lock pyproject.toml
```
