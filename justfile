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
    cd {{ api_dir }} && {{ venv_bin }}/pip install --quiet -r requirements-dev.lock
    cd {{ api_dir }} && {{ venv_bin }}/pip install --quiet -e . --no-deps

# Start Postgres, Mailpit and SeaweedFS
services-up:
    docker compose up -d --wait

# Stop local services (add `-v` to wipe data: just services-down -v)
services-down *args:
    docker compose down {{ args }}

# ─── API ──────────────────────────────────────────────────────────────────

# Run the API with auto-reload on :8000
api-dev:
    cd {{ api_dir }} && {{ venv_bin }}/uvicorn claimforge_api.main:app --reload

# Lint and typecheck the API
api-lint:
    cd {{ api_dir }} && {{ venv_bin }}/ruff check . && {{ venv_bin }}/ruff format --check . && {{ venv_bin }}/mypy

# Auto-fix lint issues and format the API
api-fix:
    cd {{ api_dir }} && {{ venv_bin }}/ruff check --fix . && {{ venv_bin }}/ruff format .

# Run API tests (pass extra pytest args: just api-test -k health)
api-test *args:
    cd {{ api_dir }} && {{ venv_bin }}/pytest {{ args }}

# Re-pin API dependencies after editing pyproject.toml
api-lock:
    cd {{ api_dir }} && {{ venv_bin }}/pip-compile -q -o requirements.lock pyproject.toml
    cd {{ api_dir }} && {{ venv_bin }}/pip-compile -q --extra dev -o requirements-dev.lock pyproject.toml

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
