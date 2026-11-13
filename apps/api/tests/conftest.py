"""Shared pytest fixtures for the API test suite.

Database tests run against real PostgreSQL:
- CI provides one through ``CLAIMFORGE_TEST_DATABASE_URL`` (a service container);
- locally, when that variable is unset, an embedded server from ``pgserver`` is started
  once per test session, so no Docker is needed.
"""

import os
import tempfile
from collections.abc import AsyncIterator, Iterator

import httpx2
import pytest
from fastapi import FastAPI
from pydantic import PostgresDsn

from claimforge_api.core.settings import Environment, Settings
from claimforge_api.main import create_app


@pytest.fixture(scope="session")
def database_url() -> Iterator[str]:
    """Async SQLAlchemy URL of a disposable test database."""
    configured = os.environ.get("CLAIMFORGE_TEST_DATABASE_URL")
    if configured:
        yield configured
        return

    # Imported lazily: only needed when no external database is configured.
    from pgserver.postgres_server import get_server

    with tempfile.TemporaryDirectory(prefix="claimforge-pg-") as data_dir:
        server = get_server(data_dir, cleanup_mode="stop")
        uri: str = server.get_uri()
        yield uri.replace("postgresql://", "postgresql+asyncpg://", 1)
        server.cleanup()


@pytest.fixture
def settings(database_url: str) -> Settings:
    """Test settings, independent of any developer .env file."""
    return Settings(
        _env_file=None,
        environment=Environment.TEST,
        database_url=PostgresDsn(database_url),
    )


@pytest.fixture
async def app(settings: Settings) -> AsyncIterator[FastAPI]:
    """A fresh application instance per test so dependency overrides never leak."""
    application = create_app(settings)
    yield application
    await application.state.engine.dispose()


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[httpx2.AsyncClient]:
    """An async HTTP client bound to the in-process ASGI app (no network)."""
    transport = httpx2.ASGITransport(app=app)
    async with httpx2.AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c
