from collections.abc import AsyncIterator

import httpx2
import pytest
from fastapi import APIRouter, FastAPI

from claimforge_api.api.deps import PageParamsDep

router = APIRouter()


@router.get("/echo-page")
async def echo_page(page: PageParamsDep) -> dict[str, object]:
    return {"limit": page.limit, "cursor": page.cursor}


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[httpx2.AsyncClient]:
    app.include_router(router)
    transport = httpx2.ASGITransport(app=app)
    async with httpx2.AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c


async def test_defaults(client: httpx2.AsyncClient) -> None:
    assert (await client.get("/echo-page")).json() == {"limit": 25, "cursor": None}


async def test_passes_limit_and_cursor(client: httpx2.AsyncClient) -> None:
    response = await client.get("/echo-page", params={"limit": 50, "cursor": "abc"})

    assert response.json() == {"limit": 50, "cursor": "abc"}


@pytest.mark.parametrize("limit", [0, 101, "many"])
async def test_rejects_out_of_range_limits(client: httpx2.AsyncClient, limit: int | str) -> None:
    response = await client.get("/echo-page", params={"limit": limit})

    assert response.status_code == 422
    assert response.json()["errors"][0]["loc"] == ["query", "limit"]
