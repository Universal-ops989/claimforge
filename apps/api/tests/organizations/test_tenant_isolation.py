"""Two users in two organizations must never see or touch each other's data."""

import httpx2
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.core.settings import Settings
from claimforge_api.core.tokens import create_access_token
from claimforge_api.users import service as users


async def other_client(
    app: FastAPI, db_session: AsyncSession, settings: Settings
) -> httpx2.AsyncClient:
    outsider = await users.create_user(
        db_session, email="outsider@example.com", full_name="Outsider", password=None
    )
    token = create_access_token(outsider.id, settings).token
    return httpx2.AsyncClient(
        transport=httpx2.ASGITransport(app=app),
        base_url="http://testserver",
        headers={"Authorization": f"Bearer {token}"},
    )


async def test_organizations_are_invisible_to_non_members(
    app: FastAPI,
    auth_client: httpx2.AsyncClient,
    db_session: AsyncSession,
    settings: Settings,
) -> None:
    mine = (await auth_client.post("/v1/organizations", json={"name": "Mine"})).json()
    async with await other_client(app, db_session, settings) as outsider:
        theirs = (await outsider.post("/v1/organizations", json={"name": "Theirs"})).json()

        # Each user lists only their own organization.
        assert [o["name"] for o in (await outsider.get("/v1/organizations")).json()["items"]] == [
            "Theirs"
        ]

        # Reading, editing or deleting someone else's organization looks like it doesn't exist.
        url = f"/v1/organizations/{mine['id']}"
        assert (await outsider.get(url)).status_code == 404
        assert (await outsider.patch(url, json={"name": "Hijacked"})).status_code == 404
        assert (await outsider.delete(url)).status_code == 404

    assert [o["name"] for o in (await auth_client.get("/v1/organizations")).json()["items"]] == [
        "Mine"
    ]
    assert (await auth_client.get(f"/v1/organizations/{mine['id']}")).json()["name"] == "Mine"
    assert (await auth_client.get(f"/v1/organizations/{theirs['id']}")).status_code == 404


async def test_organization_endpoints_require_sign_in(client: httpx2.AsyncClient) -> None:
    assert (await client.get("/v1/organizations")).status_code == 401
    assert (await client.post("/v1/organizations", json={"name": "Anon"})).status_code == 401
