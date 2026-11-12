"""Shared pytest fixtures for the API test suite."""

from collections.abc import AsyncIterator

import httpx2
import pytest
from fastapi import FastAPI

from claimforge_api.main import create_app


@pytest.fixture
def app() -> FastAPI:
    """A fresh application instance per test so dependency overrides never leak."""
    return create_app()


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[httpx2.AsyncClient]:
    """An async HTTP client bound to the in-process ASGI app (no network)."""
    transport = httpx2.ASGITransport(app=app)
    async with httpx2.AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c
