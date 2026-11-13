import httpx2
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.core.settings import Settings
from claimforge_api.core.tokens import decode_access_token
from claimforge_api.users import service as users

PASSWORD = "tile grout and drywall"


@pytest.fixture
async def account(db_session: AsyncSession) -> str:
    user = await users.create_user(
        db_session, email="dana@example.com", full_name="Dana Whitfield", password=PASSWORD
    )
    return user.email


async def login(
    client: httpx2.AsyncClient, email: str, password: str = PASSWORD
) -> httpx2.Response:
    return await client.post(
        "/v1/auth/login",
        json={"email": email, "password": password},
        headers={"User-Agent": "ClaimForge iOS/1.0"},
    )


async def test_login_returns_a_token_pair(
    client: httpx2.AsyncClient, account: str, settings: Settings
) -> None:
    response = await login(client, account.upper())
    body = response.json()

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == settings.access_token_ttl_minutes * 60
    assert body["refresh_token"]
    claims = decode_access_token(body["access_token"], settings)
    assert str(claims.user_id)


@pytest.mark.parametrize(
    ("email", "password"),
    [("dana@example.com", "wrong password!"), ("nobody@example.com", PASSWORD)],
)
async def test_login_failures_are_indistinguishable(
    client: httpx2.AsyncClient, account: str, email: str, password: str
) -> None:
    response = await login(client, email, password)

    assert response.status_code == 401
    assert response.json()["code"] == "invalid_credentials"
    assert response.json()["detail"] == "Invalid email or password"


async def test_login_validates_input(client: httpx2.AsyncClient) -> None:
    response = await client.post("/v1/auth/login", json={"email": "not-an-email", "password": ""})

    assert response.status_code == 422
    assert {tuple(e["loc"]) for e in response.json()["errors"]} == {
        ("body", "email"),
        ("body", "password"),
    }


async def test_refresh_rotates_and_detects_reuse(client: httpx2.AsyncClient, account: str) -> None:
    first = (await login(client, account)).json()

    refreshed = await client.post(
        "/v1/auth/refresh", json={"refresh_token": first["refresh_token"]}
    )
    assert refreshed.status_code == 200
    second = refreshed.json()
    assert second["refresh_token"] != first["refresh_token"]

    replay = await client.post("/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert replay.status_code == 401
    assert replay.json()["code"] == "refresh_token_reused"

    # The theft response also killed the legitimate successor.
    after = await client.post("/v1/auth/refresh", json={"refresh_token": second["refresh_token"]})
    assert after.status_code == 401


async def test_logout_ends_the_session(client: httpx2.AsyncClient, account: str) -> None:
    tokens = (await login(client, account)).json()

    logout = await client.post("/v1/auth/logout", json={"refresh_token": tokens["refresh_token"]})
    refresh = await client.post("/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})

    assert logout.status_code == 204
    assert refresh.status_code == 401


async def test_unknown_refresh_token_is_401(client: httpx2.AsyncClient) -> None:
    response = await client.post("/v1/auth/refresh", json={"refresh_token": "nope"})

    assert response.status_code == 401
    assert response.json()["code"] == "invalid_refresh_token"
