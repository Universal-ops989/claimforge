import httpx2
import pytest
from fastapi import FastAPI

from claimforge_api.core.settings import Settings


async def attempt(client: httpx2.AsyncClient, email: str) -> httpx2.Response:
    return await client.post(
        "/v1/auth/login", json={"email": email, "password": "definitely wrong"}
    )


async def test_repeated_logins_for_one_account_are_throttled(client: httpx2.AsyncClient) -> None:
    statuses = [(await attempt(client, "target@example.com")).status_code for _ in range(5)]
    throttled = await attempt(client, "TARGET@example.com")  # same account, any casing

    assert statuses == [401] * 5
    assert throttled.status_code == 429
    assert throttled.json()["code"] == "rate_limited"
    assert int(throttled.headers["retry-after"]) >= 1

    # Other accounts are unaffected.
    assert (await attempt(client, "someone.else@example.com")).status_code == 401


@pytest.fixture
def unlimited_app(app: FastAPI, settings: Settings) -> FastAPI:
    app.state.settings = settings.model_copy(update={"rate_limit_enabled": False})
    return app


async def test_can_be_disabled(unlimited_app: FastAPI, client: httpx2.AsyncClient) -> None:
    statuses = {(await attempt(client, "target@example.com")).status_code for _ in range(8)}

    assert statuses == {401}
