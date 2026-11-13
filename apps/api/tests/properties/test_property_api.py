"""Properties over HTTP: nested addresses, duplicates, validation, roles and audit."""

from typing import Any
from uuid import UUID

import httpx2
import pytest
from tests.conftest import ClientFor

from claimforge_api.users.models import Role

AUSTIN = {"city": "Austin", "region": "TX", "postal_code": "78701"}


@pytest.fixture
def url(organization_id: UUID) -> str:
    return f"/v1/organizations/{organization_id}/properties"


async def create(
    client: httpx2.AsyncClient, url: str, line1: str = "123 Main St", **fields: Any
) -> dict[str, Any]:
    address = AUSTIN | {"line1": line1} | fields.pop("address", {})
    response = await client.post(url, json={"address": address, **fields})
    assert response.status_code == 201, response.text
    payload: dict[str, Any] = response.json()
    return payload


async def test_create_get_update_delete(auth_client: httpx2.AsyncClient, url: str) -> None:
    created = await create(
        auth_client,
        url,
        "4500 north lamar boulevard suite 200",
        address={"region": "texas"},
        property_type="commercial",
        year_built=1984,
    )
    assert created["address"] == {
        "line1": "4500 N Lamar Blvd",
        "line2": "Ste 200",
        "city": "Austin",
        "region": "TX",
        "postal_code": "78701",
        "country": "US",
        "formatted": "4500 N Lamar Blvd Ste 200, Austin, TX 78701",
    }
    assert created["property_type"] == "commercial"
    assert (await auth_client.get(f"{url}/{created['id']}")).json() == created

    patched = await auth_client.patch(
        f"{url}/{created['id']}",
        json={"access_notes": "Loading dock at the back", "latitude": 30.31, "longitude": -97.74},
    )
    assert patched.status_code == 200
    assert patched.json()["access_notes"] == "Loading dock at the back"
    assert patched.json()["latitude"] == 30.31
    assert patched.json()["address"] == created["address"]

    assert (await auth_client.delete(f"{url}/{created['id']}")).status_code == 204
    missing = await auth_client.get(f"{url}/{created['id']}")
    assert missing.status_code == 404
    assert missing.json()["property_id"] == created["id"]


async def test_duplicate_address_is_409_with_the_existing_id(
    auth_client: httpx2.AsyncClient, url: str
) -> None:
    first = await create(auth_client, url, "123 N Main St")

    response = await auth_client.post(
        url, json={"address": AUSTIN | {"line1": "123 north main street"}}
    )

    assert response.status_code == 409
    assert response.json()["code"] == "property_exists"
    assert response.json()["existing_property_id"] == first["id"]


@pytest.mark.parametrize(
    ("address", "loc"),
    [
        ({"postal_code": "7870"}, ["body", "address", "postal_code"]),
        ({"region": "Texass"}, ["body", "address", "region"]),
        ({"country": "Germany"}, ["body", "address", "country"]),
        ({"line1": "PO Box 77"}, ["body", "address"]),
    ],
)
async def test_address_errors_point_at_the_field(
    auth_client: httpx2.AsyncClient, url: str, address: dict[str, str], loc: list[str]
) -> None:
    response = await auth_client.post(
        url, json={"address": AUSTIN | {"line1": "1 Main St"} | address}
    )

    assert response.status_code == 422
    assert [e["loc"] for e in response.json()["errors"]] == [loc]


async def test_list_pages_newest_first_and_filters(
    auth_client: httpx2.AsyncClient, url: str
) -> None:
    for n in range(1, 6):
        await create(auth_client, url, f"{n} Elm St")
    await create(
        auth_client, url, "9 Lake Dr", address={"city": "Round Rock", "postal_code": "78664"}
    )

    seen: list[str] = []
    cursor = None
    while True:
        params: dict[str, str | int] = {"limit": 4, "postal_code": "78701"}
        if cursor:
            params["cursor"] = cursor
        page = (await auth_client.get(url, params=params)).json()
        seen += [p["address"]["line1"] for p in page["items"]]
        cursor = page["next_cursor"]
        if not page["has_more"]:
            break

    assert seen == ["5 Elm St", "4 Elm St", "3 Elm St", "2 Elm St", "1 Elm St"]
    by_city = (await auth_client.get(url, params={"q": "round"})).json()["items"]
    assert [p["address"]["line1"] for p in by_city] == ["9 Lake Dr"]


async def test_roles(auth_client: httpx2.AsyncClient, client_for: ClientFor, url: str) -> None:
    prop = await create(auth_client, url)
    viewer = await client_for(Role.VIEWER)
    adjuster = await client_for(Role.ADJUSTER)
    admin = await client_for(Role.ADMIN)
    outsider = await client_for(None)
    item = f"{url}/{prop['id']}"

    assert (await viewer.get(item)).status_code == 200
    assert (await viewer.patch(item, json={"year_built": 1990})).status_code == 403
    assert (await adjuster.patch(item, json={"year_built": 1990})).status_code == 200
    denied = await adjuster.delete(item)
    assert denied.status_code == 403
    assert denied.json()["required_permission"] == "claims:delete"
    assert (await admin.delete(item)).status_code == 204
    assert (await outsider.get(url)).status_code == 404


async def test_anonymous_users_are_turned_away(client: httpx2.AsyncClient, url: str) -> None:
    assert (await client.get(url)).status_code == 401


async def test_changes_show_up_in_the_audit_timeline(
    auth_client: httpx2.AsyncClient, url: str, organization_id: UUID
) -> None:
    prop = await create(auth_client, url)
    await auth_client.patch(f"{url}/{prop['id']}", json={"property_type": "multi_family"})

    timeline = await auth_client.get(
        f"/v1/organizations/{organization_id}/audit-events",
        params={"entity_type": "property", "entity_id": prop["id"]},
    )

    events = timeline.json()["items"]
    assert [e["action"] for e in events] == ["property.updated", "property.created"]
    assert events[0]["changes"] == {"property_type": ["residential", "multi_family"]}
