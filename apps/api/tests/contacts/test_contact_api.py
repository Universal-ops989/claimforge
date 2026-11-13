"""Contacts over HTTP: validation, pagination, roles and the audit trail."""

from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Any
from uuid import UUID

import httpx2
import pytest
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.core.settings import Settings
from claimforge_api.core.tokens import create_access_token
from claimforge_api.users import service as users
from claimforge_api.users.models import Membership, Role

ClientFor = Callable[[Role | None], Awaitable[httpx2.AsyncClient]]


@pytest.fixture
def url(organization_id: UUID) -> str:
    return f"/v1/organizations/{organization_id}/contacts"


@pytest.fixture
async def client_for(
    app: FastAPI, db_session: AsyncSession, settings: Settings, organization_id: UUID
) -> AsyncIterator[ClientFor]:
    """Factory: a signed-in client for a new member with ``role`` (``None``: not a member)."""
    clients: list[httpx2.AsyncClient] = []

    async def make(role: Role | None) -> httpx2.AsyncClient:
        person = await users.create_user(
            db_session, email=f"{role or 'outsider'}@example.com", full_name="Someone"
        )
        if role is not None:
            db_session.add(
                Membership(organization_id=organization_id, user_id=person.id, role=role)
            )
            await db_session.commit()
        client = httpx2.AsyncClient(
            transport=httpx2.ASGITransport(app=app),
            base_url="http://testserver",
            headers={"Authorization": f"Bearer {create_access_token(person.id, settings).token}"},
        )
        clients.append(client)
        return client

    yield make
    for client in clients:
        await client.aclose()


async def create(client: httpx2.AsyncClient, url: str, **body: object) -> dict[str, Any]:
    response = await client.post(url, json=body)
    assert response.status_code == 201, response.text
    payload: dict[str, Any] = response.json()
    return payload


async def test_create_get_update_delete(auth_client: httpx2.AsyncClient, url: str) -> None:
    created = await create(
        auth_client,
        url,
        full_name="Dana Whitfield",
        email="Dana@Example.com",
        phone="(512) 555-0142",
        preferred_contact_method="text",
    )
    assert created["kind"] == "policyholder"
    assert created["email"] == "dana@example.com"
    assert created["phone"] == "+15125550142"
    assert (await auth_client.get(f"{url}/{created['id']}")).json() == created

    patched = await auth_client.patch(
        f"{url}/{created['id']}", json={"company_name": "Whitfield Farms", "email": ""}
    )
    assert patched.status_code == 200
    assert patched.json()["company_name"] == "Whitfield Farms"
    assert patched.json()["email"] is None
    assert patched.json()["phone"] == "+15125550142"

    assert (await auth_client.delete(f"{url}/{created['id']}")).status_code == 204
    missing = await auth_client.get(f"{url}/{created['id']}")
    assert missing.status_code == 404
    assert missing.json()["contact_id"] == created["id"]


@pytest.mark.parametrize(
    ("body", "field"),
    [
        ({"full_name": ""}, "full_name"),
        ({"full_name": "Dana", "kind": "landlord"}, "kind"),
        ({"full_name": "Dana", "email": "not-an-email"}, "email"),
        ({"full_name": "Dana", "phone": "555-0142"}, "phone"),
        ({"full_name": "Dana", "preferred_contact_method": "fax"}, "preferred_contact_method"),
        ({"full_name": "Dana", "organization_id": "x"}, "organization_id"),
    ],
)
async def test_create_validates_input(
    auth_client: httpx2.AsyncClient, url: str, body: dict[str, object], field: str
) -> None:
    response = await auth_client.post(url, json=body)

    assert response.status_code == 422
    assert response.json()["errors"][0]["loc"][-1] == field


async def test_phone_errors_explain_the_expected_format(
    auth_client: httpx2.AsyncClient, url: str
) -> None:
    response = await auth_client.post(url, json={"full_name": "Dana", "phone": "44 20 7946 0958"})

    assert "include the country code" in response.json()["errors"][0]["message"]


async def test_full_name_cannot_be_nulled(auth_client: httpx2.AsyncClient, url: str) -> None:
    created = await create(auth_client, url, full_name="Dana")

    response = await auth_client.patch(f"{url}/{created['id']}", json={"full_name": None})

    assert response.status_code == 422


async def test_preferred_method_without_details_is_a_business_rule(
    auth_client: httpx2.AsyncClient, url: str
) -> None:
    response = await auth_client.post(
        url, json={"full_name": "Dana", "preferred_contact_method": "email"}
    )

    assert response.status_code == 422
    assert response.json()["code"] == "contact_method_unavailable"
    assert response.json()["preferred_contact_method"] == "email"


async def test_list_pages_through_contacts_in_name_order(
    auth_client: httpx2.AsyncClient, url: str
) -> None:
    for name in ["Erin", "Alex", "Drew", "Casey", "Blake"]:
        await create(auth_client, url, full_name=name)

    seen: list[str] = []
    cursor = None
    while True:
        params: dict[str, str | int] = {"limit": 2}
        if cursor:
            params["cursor"] = cursor
        page = (await auth_client.get(url, params=params)).json()
        seen += [c["full_name"] for c in page["items"]]
        cursor = page["next_cursor"]
        if not page["has_more"]:
            break

    assert seen == ["Alex", "Blake", "Casey", "Drew", "Erin"]


async def test_list_filters_by_kind_and_query(auth_client: httpx2.AsyncClient, url: str) -> None:
    await create(auth_client, url, full_name="Pat Owner")
    await create(auth_client, url, full_name="Riley Renter", kind="tenant", phone="713 555 0101")

    tenants = (await auth_client.get(url, params={"kind": "tenant"})).json()["items"]
    by_phone = (await auth_client.get(url, params={"q": "555-0101"})).json()["items"]

    assert [c["full_name"] for c in tenants] == ["Riley Renter"]
    assert [c["full_name"] for c in by_phone] == ["Riley Renter"]
    assert (await auth_client.get(url, params={"kind": "landlord"})).status_code == 422


@pytest.mark.parametrize("role", [Role.VIEWER, Role.TECHNICIAN])
async def test_readers_cannot_write(
    auth_client: httpx2.AsyncClient, client_for: ClientFor, url: str, role: Role
) -> None:
    contact = await create(auth_client, url, full_name="Dana")
    client = await client_for(role)

    assert (await client.get(url)).status_code == 200
    assert (await client.get(f"{url}/{contact['id']}")).status_code == 200
    denied = [
        await client.post(url, json={"full_name": "New"}),
        await client.patch(f"{url}/{contact['id']}", json={"full_name": "Renamed"}),
        await client.delete(f"{url}/{contact['id']}"),
    ]
    assert [r.status_code for r in denied] == [403, 403, 403]
    assert denied[0].json()["required_permission"] == "contacts:write"


async def test_adjusters_can_write(client_for: ClientFor, url: str) -> None:
    adjuster = await client_for(Role.ADJUSTER)

    contact = await create(adjuster, url, full_name="Dana")

    assert (await adjuster.delete(f"{url}/{contact['id']}")).status_code == 204


async def test_non_members_and_anonymous_users_are_turned_away(
    auth_client: httpx2.AsyncClient, client: httpx2.AsyncClient, client_for: ClientFor, url: str
) -> None:
    contact = await create(auth_client, url, full_name="Dana")
    outsider = await client_for(None)

    assert (await outsider.get(url)).status_code == 404
    assert (await outsider.get(f"{url}/{contact['id']}")).status_code == 404
    assert (await outsider.post(url, json={"full_name": "Sneaky"})).status_code == 404
    assert (await client.get(url)).status_code == 401


async def test_changes_show_up_in_the_audit_timeline(
    auth_client: httpx2.AsyncClient, url: str, organization_id: UUID
) -> None:
    contact = await create(auth_client, url, full_name="Dana")
    await auth_client.patch(f"{url}/{contact['id']}", json={"kind": "tenant"})

    timeline = await auth_client.get(
        f"/v1/organizations/{organization_id}/audit-events",
        params={"entity_type": "contact", "entity_id": contact["id"]},
    )

    events = timeline.json()["items"]
    assert [e["action"] for e in events] == ["contact.updated", "contact.created"]
    assert events[0]["changes"] == {"kind": ["policyholder", "tenant"]}
    assert events[0]["actor"]["full_name"] == "Morgan Member"
