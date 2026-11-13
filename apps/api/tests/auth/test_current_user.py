from datetime import UTC, datetime, timedelta

import httpx2
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.core.settings import Settings
from claimforge_api.core.tokens import create_access_token
from claimforge_api.users.models import User


async def test_me_requires_a_token(client: httpx2.AsyncClient) -> None:
    response = await client.get("/v1/me")

    assert response.status_code == 401
    assert response.json()["code"] == "authentication_required"
    assert response.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize("header", ["Bearer not-a-jwt", "Basic dXNlcjpwYXNz", "Bearer"])
async def test_malformed_credentials_are_rejected(client: httpx2.AsyncClient, header: str) -> None:
    response = await client.get("/v1/me", headers={"Authorization": header})

    assert response.status_code == 401


async def test_invalid_tokens_carry_an_rfc6750_challenge(client: httpx2.AsyncClient) -> None:
    response = await client.get("/v1/me", headers={"Authorization": "Bearer not-a-jwt"})

    assert response.json()["code"] == "invalid_token"
    assert response.headers["www-authenticate"].startswith('Bearer error="invalid_token"')


async def test_expired_tokens_say_so(
    client: httpx2.AsyncClient, user: User, settings: Settings
) -> None:
    old = create_access_token(user.id, settings, now=datetime.now(UTC) - timedelta(hours=2))

    response = await client.get("/v1/me", headers={"Authorization": f"Bearer {old.token}"})

    assert response.status_code == 401
    assert response.json()["code"] == "token_expired"


async def test_deactivation_takes_effect_before_the_token_expires(
    auth_client: httpx2.AsyncClient, user: User, db_session: AsyncSession
) -> None:
    assert (await auth_client.get("/v1/me")).status_code == 200

    user.is_active = False
    await db_session.commit()

    response = await auth_client.get("/v1/me")
    assert response.status_code == 401
    assert response.json()["code"] == "invalid_token"


async def test_me_lists_memberships(auth_client: httpx2.AsyncClient, user: User) -> None:
    await auth_client.post("/v1/organizations", json={"name": "Rivera Restoration"})
    await auth_client.post("/v1/organizations", json={"name": "Atlas Adjusting"})

    body = (await auth_client.get("/v1/me")).json()

    assert body["email"] == user.email
    assert [(m["organization"]["name"], m["role"]) for m in body["memberships"]] == [
        ("Atlas Adjusting", "owner"),
        ("Rivera Restoration", "owner"),
    ]
