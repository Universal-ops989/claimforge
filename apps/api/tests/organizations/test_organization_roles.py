"""Who may edit or delete an organization, over HTTP."""

from collections.abc import AsyncIterator, Awaitable, Callable
from uuid import UUID

import httpx2
import pytest
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.core.settings import Settings
from claimforge_api.core.tokens import create_access_token
from claimforge_api.users import service as users
from claimforge_api.users.models import Membership, Role

ClientFor = Callable[[Role], Awaitable[httpx2.AsyncClient]]


@pytest.fixture
async def organization_id(auth_client: httpx2.AsyncClient) -> UUID:
    created = await auth_client.post("/v1/organizations", json={"name": "Rivera Restoration"})
    return UUID(created.json()["id"])


@pytest.fixture
async def client_for(
    app: FastAPI, db_session: AsyncSession, settings: Settings, organization_id: UUID
) -> AsyncIterator[ClientFor]:
    """Factory: a signed-in client for a new member with the given role."""
    clients: list[httpx2.AsyncClient] = []

    async def make(role: Role) -> httpx2.AsyncClient:
        member = await users.create_user(
            db_session, email=f"{role}@example.com", full_name=f"A {role}"
        )
        db_session.add(Membership(organization_id=organization_id, user_id=member.id, role=role))
        await db_session.commit()
        client = httpx2.AsyncClient(
            transport=httpx2.ASGITransport(app=app),
            base_url="http://testserver",
            headers={"Authorization": f"Bearer {create_access_token(member.id, settings).token}"},
        )
        clients.append(client)
        return client

    yield make
    for client in clients:
        await client.aclose()


@pytest.mark.parametrize("role", [Role.VIEWER, Role.TECHNICIAN, Role.ADJUSTER])
async def test_non_admins_can_read_but_not_edit(
    client_for: ClientFor, organization_id: UUID, role: Role
) -> None:
    client = await client_for(role)
    url = f"/v1/organizations/{organization_id}"

    assert (await client.get(url)).status_code == 200
    response = await client.patch(url, json={"name": "Renamed"})

    assert response.status_code == 403
    assert response.json()["code"] == "permission_denied"
    assert response.json()["required_permission"] == "org:update"


async def test_admins_can_edit_but_not_delete(client_for: ClientFor, organization_id: UUID) -> None:
    admin = await client_for(Role.ADMIN)
    url = f"/v1/organizations/{organization_id}"

    assert (await admin.patch(url, json={"name": "Renamed"})).json()["name"] == "Renamed"
    denied = await admin.delete(url)
    assert denied.status_code == 403
    assert denied.json()["required_permission"] == "org:delete"


async def test_owners_can_delete(auth_client: httpx2.AsyncClient, organization_id: UUID) -> None:
    url = f"/v1/organizations/{organization_id}"

    assert (await auth_client.delete(url)).status_code == 204
    assert (await auth_client.get(url)).status_code == 404


async def test_me_reports_permissions_per_membership(
    client_for: ClientFor,
) -> None:
    technician = await client_for(Role.TECHNICIAN)

    [membership] = (await technician.get("/v1/me")).json()["memberships"]

    assert membership["role"] == "technician"
    assert membership["permissions"] == sorted(
        ["org:read", "members:read", "claims:read", "field_data:write"]
    )
