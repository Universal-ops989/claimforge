# ClaimForge task runner. Run `just` to list recipes.

set windows-shell := ["bash", "-uc"]
set shell := ["bash", "-uc"]

api_dir := "apps/api"
venv_bin := if os_family() == "windows" { ".venv/Scripts" } else { ".venv/bin" }

# List available recipes
default:
    @just --list --unsorted

# ─── Setup ────────────────────────────────────────────────────────────────

# Install all JS and Python dependencies
install: install-web install-api

# Install the pnpm workspace
install-web:
    pnpm install --frozen-lockfile

# Create the API virtualenv and install pinned dependencies
install-api:
    cd {{ api_dir }} && ( test -d .venv || python -m venv .venv )
    cd {{ api_dir }} && {{ venv_bin }}/python -m pip install --quiet --upgrade pip
    cd {{ api_dir }} && {{ venv_bin }}/python -m pip install --quiet -r requirements-dev.lock
    cd {{ api_dir }} && {{ venv_bin }}/python -m pip install --quiet -e . --no-deps

# Start Postgres, Mailpit and SeaweedFS
services-up:
    docker compose up -d --wait

# Stop local services (add `-v` to wipe data: just services-down -v)
services-down *args:
    docker compose down {{ args }}

# ─── API ──────────────────────────────────────────────────────────────────

# Run the API with auto-reload on :8000
api-dev:
    cd {{ api_dir }} && {{ venv_bin }}/python -m uvicorn claimforge_api.main:create_production_app --factory --reload

# Lint and typecheck the API
api-lint:
    cd {{ api_dir }} && {{ venv_bin }}/python -m ruff check . && {{ venv_bin }}/python -m ruff format --check . && {{ venv_bin }}/python -m mypy

# Auto-fix lint issues and format the API
api-fix:
    cd {{ api_dir }} && {{ venv_bin }}/python -m ruff check --fix . && {{ venv_bin }}/python -m ruff format .

# Run API tests (pass extra pytest args: just api-test -k health)
api-test *args:
    cd {{ api_dir }} && {{ venv_bin }}/python -m pytest {{ args }}

# Re-pin API dependencies after editing pyproject.toml
api-lock:
    cd {{ api_dir }} && {{ venv_bin }}/python -m piptools compile -q -o requirements.lock pyproject.toml
    cd {{ api_dir }} && {{ venv_bin }}/python -m piptools compile -q --extra dev -o requirements-dev.lock pyproject.toml

# Regenerate the committed OpenAPI contract (apps/api/openapi.json)
api-openapi:
    cd {{ api_dir }} && {{ venv_bin }}/python -m claimforge_api.openapi

# Apply database migrations (default: to the latest revision)
db-upgrade revision="head":
    cd {{ api_dir }} && {{ venv_bin }}/python -m alembic upgrade {{ revision }}

# Roll back database migrations (default: one step)
db-downgrade revision="-1":
    cd {{ api_dir }} && {{ venv_bin }}/python -m alembic downgrade {{ revision }}

# Generate a migration from model changes: just db-revision "add claims table"
db-revision message:
    cd {{ api_dir }} && {{ venv_bin }}/python -m alembic revision --autogenerate -m "{{ message }}"

# ─── Web ──────────────────────────────────────────────────────────────────

# Run all frontend dev servers
web-dev:
    pnpm turbo run dev

# Lint, typecheck and format-check the TypeScript workspace
web-lint:
    pnpm format:check
    pnpm turbo run lint typecheck

# Run frontend tests
web-test:
    pnpm turbo run test

# Build all frontend packages and apps
web-build:
    pnpm turbo run build build-storybook

# ─── Everything ───────────────────────────────────────────────────────────

# Run every check CI runs
check: web-lint web-test api-lint api-test

# Run Storybook for the design system on :6006
storybook:
    pnpm --filter @claimforge/ui storybook

# Run every Storybook story as a browser test (interactions + accessibility)
storybook-test:
    pnpm turbo run test-storybook
