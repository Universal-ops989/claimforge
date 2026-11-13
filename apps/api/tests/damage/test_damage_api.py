"""Damage items over HTTP: recording, the water rules as problems, roles and tenants."""

from typing import Any
from uuid import UUID, uuid4

import httpx2
import pytest
from tests.conftest import ClientFor

from claimforge_api.users.models import Role

ADDRESS = {"line1": "123 Main St", "city": "Austin", "region": "TX", "postal_code": "78701"}


async def post(client: httpx2.AsyncClient, url: str, body: dict[str, Any]) -> dict[str, Any]:
    response = await client.post(url, json=body)
    assert response.status_code == 201, response.text
    payload: dict[str, Any] = response.json()
    return payload


@pytest.fixture
def base(organization_id: UUID) -> str:
    return f"/v1/organizations/{organization_id}"


@pytest.fixture
async def claim_url(auth_client: httpx2.AsyncClient, base: str) -> str:
    claim = await post(
        auth_client, f"{base}/claims", {"loss_type": "water", "property": {"address": ADDRESS}}
    )
    return f"{base}/claims/{claim['id']}"


async def add_room(client: httpx2.AsyncClient, claim_url: str, name: str) -> dict[str, Any]:
    structures = (await client.get(f"{claim_url}/structures")).json()
    house = (
        structures[0]
        if structures
        else await post(client, f"{claim_url}/structures", {"name": "Main house"})
    )
    return await post(client, f"{claim_url}/structures/{house['id']}/rooms", {"name": name})


async def test_record_and_revise_damage(auth_client: httpx2.AsyncClient, claim_url: str) -> None:
    kitchen = await add_room(auth_client, claim_url, "Kitchen")
    bath = await add_room(auth_client, claim_url, "Bath")
    items = f"{claim_url}/rooms/{kitchen['id']}/damage-items"

    drywall = await post(
        auth_client, items, {"surface": "wall", "material": "Drywall", "water_class": 2}
    )
    assert (drywall["room_id"], drywall["cause"], drywall["water_category"]) == (
        kitchen["id"],
        "water",
        None,
    )
    toilet = await post(
        auth_client,
        f"{claim_url}/rooms/{bath['id']}/damage-items",
        {"surface": "floor", "material": "Tile", "cause": "sewage"},
    )
    assert toilet["water_category"] == 3

    url = f"{claim_url}/damage-items/{drywall['id']}"
    revised = await auth_client.patch(url, json={"water_category": 2, "room_id": bath["id"]})
    assert revised.status_code == 200, revised.text
    assert (revised.json()["room_id"], revised.json()["water_category"]) == (bath["id"], 2)
    assert (await auth_client.get(url)).json() == revised.json()

    listed = await auth_client.get(f"{claim_url}/damage-items", params={"cause": "sewage"})
    assert [i["material"] for i in listed.json()] == ["Tile"]
    in_bath = await auth_client.get(f"{claim_url}/damage-items", params={"room_id": bath["id"]})
    assert len(in_bath.json()) == 2

    assert (await auth_client.delete(url)).status_code == 204
    assert (await auth_client.get(url)).status_code == 404


async def test_water_rules_come_back_as_problems(
    auth_client: httpx2.AsyncClient, claim_url: str
) -> None:
    kitchen = await add_room(auth_client, claim_url, "Kitchen")
    items = f"{claim_url}/rooms/{kitchen['id']}/damage-items"

    black = await auth_client.post(
        items,
        json={"surface": "floor", "material": "Carpet", "cause": "flood", "water_category": 1},
    )
    assert (black.status_code, black.json()["code"], black.json()["cause"]) == (
        422,
        "black_water_category",
        "flood",
    )
    dry = await auth_client.post(
        items, json={"surface": "wall", "material": "Paneling", "cause": "fire", "water_class": 1}
    )
    assert (dry.status_code, dry.json()["code"]) == (422, "not_water_damage")

    for body in [
        {"surface": "roof", "material": "Shingles"},
        {"surface": "wall", "material": "Drywall", "water_category": 4},
        {"surface": "wall", "material": "Drywall", "extra": True},
    ]:
        assert (await auth_client.post(items, json=body)).status_code == 422, body

    unknown = await auth_client.post(
        f"{claim_url}/rooms/{uuid4()}/damage-items", json={"surface": "wall", "material": "X"}
    )
    assert unknown.status_code == 404
    bad_filter = await auth_client.get(f"{claim_url}/damage-items", params={"cause": "aliens"})
    assert bad_filter.status_code == 422


async def test_roles_and_tenants(
    auth_client: httpx2.AsyncClient, client_for: ClientFor, claim_url: str
) -> None:
    kitchen = await add_room(auth_client, claim_url, "Kitchen")
    items = f"{claim_url}/rooms/{kitchen['id']}/damage-items"
    technician = await client_for(Role.TECHNICIAN)
    viewer = await client_for(Role.VIEWER)
    outsider = await client_for(None)

    item = await post(technician, items, {"surface": "wall", "material": "Drywall"})

    assert (await viewer.get(f"{claim_url}/damage-items")).status_code == 200
    denied = await viewer.patch(f"{claim_url}/damage-items/{item['id']}", json={"material": "X"})
    assert (denied.status_code, denied.json()["required_permission"]) == (
        403,
        "field_data:write",
    )
    assert (await outsider.get(f"{claim_url}/damage-items")).status_code == 404
    assert (await outsider.get(f"{claim_url}/damage-items/{item['id']}")).status_code == 404


async def test_closed_claims_are_read_only(auth_client: httpx2.AsyncClient, claim_url: str) -> None:
    kitchen = await add_room(auth_client, claim_url, "Kitchen")
    cancelled = await auth_client.post(
        f"{claim_url}/status", json={"status": "cancelled", "reason": "Duplicate"}
    )
    assert cancelled.status_code == 200, cancelled.text

    locked = await auth_client.post(
        f"{claim_url}/rooms/{kitchen['id']}/damage-items",
        json={"surface": "wall", "material": "Drywall"},
    )
    assert (locked.status_code, locked.json()["code"]) == (409, "claim_locked")
    assert (await auth_client.get(f"{claim_url}/damage-items")).status_code == 200


async def test_damage_shows_up_in_the_audit_timeline(
    auth_client: httpx2.AsyncClient, base: str, claim_url: str
) -> None:
    kitchen = await add_room(auth_client, claim_url, "Kitchen")
    await post(
        auth_client,
        f"{claim_url}/rooms/{kitchen['id']}/damage-items",
        {"surface": "ceiling", "material": "Popcorn ceiling", "water_category": 2},
    )

    events = await auth_client.get(f"{base}/audit-events", params={"entity_type": "damage_item"})

    [created] = events.json()["items"]
    assert created["actor"]["full_name"] == "Morgan Member"
    assert created["changes"]["water_category"] == [None, 2]
