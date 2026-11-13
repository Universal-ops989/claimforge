import httpx2
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.users import service as users
from claimforge_api.users.models import Membership, Role, User


@pytest.fixture
async def org_id(auth_client: httpx2.AsyncClient) -> str:
    response = await auth_client.post("/v1/organizations", json={"name": "Audited Org"})
    org_id: str = response.json()["id"]
    await auth_client.patch(f"/v1/organizations/{org_id}", json={"name": "Audited Org 2"})
    return org_id


async def test_timeline_is_newest_first_with_actor_names(
    auth_client: httpx2.AsyncClient, org_id: str, user: User
) -> None:
    body = (await auth_client.get(f"/v1/organizations/{org_id}/audit-events")).json()

    actions = [e["action"] for e in body["items"]]
    assert actions[0] == "organization.updated"
    assert set(actions) == {"organization.updated", "organization.created", "membership.created"}
    assert body["items"][0]["actor"] == {"id": str(user.id), "full_name": user.full_name}
    assert body["items"][0]["changes"] == {"name": ["Audited Org", "Audited Org 2"]}


async def test_filters_by_entity(auth_client: httpx2.AsyncClient, org_id: str) -> None:
    body = (
        await auth_client.get(
            f"/v1/organizations/{org_id}/audit-events", params={"entity_type": "membership"}
        )
    ).json()

    assert [e["action"] for e in body["items"]] == ["membership.created"]


async def test_paginates(auth_client: httpx2.AsyncClient, org_id: str) -> None:
    first = (
        await auth_client.get(f"/v1/organizations/{org_id}/audit-events", params={"limit": 2})
    ).json()
    rest = (
        await auth_client.get(
            f"/v1/organizations/{org_id}/audit-events",
            params={"limit": 2, "cursor": first["next_cursor"]},
        )
    ).json()

    assert first["has_more"] is True
    assert len(first["items"]) + len(rest["items"]) == 3


async def test_requires_audit_read(
    auth_client: httpx2.AsyncClient,
    client: httpx2.AsyncClient,
    db_session: AsyncSession,
    org_id: str,
) -> None:
    adjuster = await users.create_user(
        db_session, email="adj@example.com", full_name="Adj", password="tile grout and drywall"
    )
    db_session.add(Membership(organization_id=org_id, user_id=adjuster.id, role=Role.ADJUSTER))
    await db_session.commit()
    login = await client.post(
        "/v1/auth/login", json={"email": "adj@example.com", "password": "tile grout and drywall"}
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    response = await client.get(f"/v1/organizations/{org_id}/audit-events", headers=headers)

    assert response.status_code == 403
    assert response.json()["required_permission"] == "audit:read"
