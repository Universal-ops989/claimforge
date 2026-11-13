"""Structures and rooms over HTTP: layout, validation, roles, tenants and locked claims."""

from typing import Any
from uuid import UUID, uuid4

import httpx2
import pytest
from tests.conftest import ClientFor

from claimforge_api.users.models import Role

ADDRESS = {"line1": "123 Main St", "city": "Austin", "region": "TX", "postal_code": "78701"}


@pytest.fixture
def base(organization_id: UUID) -> str:
    return f"/v1/organizations/{organization_id}"


async def post(client: httpx2.AsyncClient, url: str, body: dict[str, Any]) -> dict[str, Any]:
    response = await client.post(url, json=body)
    assert response.status_code == 201, response.text
    payload: dict[str, Any] = response.json()
    return payload


@pytest.fixture
async def claim_url(auth_client: httpx2.AsyncClient, base: str) -> str:
    claim = await post(
        auth_client, f"{base}/claims", {"loss_type": "water", "property": {"address": ADDRESS}}
    )
    return f"{base}/claims/{claim['id']}"


async def test_lay_out_a_claim(auth_client: httpx2.AsyncClient, claim_url: str) -> None:
    house = await post(auth_client, f"{claim_url}/structures", {"name": "Main house"})
    garage = await post(auth_client, f"{claim_url}/structures", {"name": "Garage"})
    kitchen = await post(
        auth_client,
        f"{claim_url}/structures/{house['id']}/rooms",
        {
            "name": "Kitchen",
            "level": "Main floor",
            "length_ft": 12.5,
            "width_ft": 10.25,
            "height_ft": 8,
        },
    )

    assert house["rooms"] == []
    assert kitchen["structure_id"] == house["id"]
    # Numbers in, numbers out.
    assert (kitchen["length_ft"], kitchen["floor_area_sqft"], kitchen["volume_cuft"]) == (
        12.5,
        128.13,
        1025.0,
    )
    assert kitchen["wall_area_sqft"] == 364.0

    room_url = f"{claim_url}/rooms/{kitchen['id']}"
    moved = await auth_client.patch(
        room_url, json={"structure_id": garage["id"], "height_ft": None}
    )
    assert moved.status_code == 200, moved.text
    assert (moved.json()["structure_id"], moved.json()["volume_cuft"]) == (garage["id"], None)
    assert (await auth_client.get(room_url)).json() == moved.json()

    renamed = await auth_client.patch(
        f"{claim_url}/structures/{house['id']}", json={"name": "House"}
    )
    assert renamed.json()["name"] == "House"

    plan = (await auth_client.get(f"{claim_url}/structures")).json()
    assert [(s["name"], [r["name"] for r in s["rooms"]]) for s in plan] == [
        ("House", []),
        ("Garage", ["Kitchen"]),
    ]

    assert (await auth_client.delete(room_url)).status_code == 204
    assert (await auth_client.get(room_url)).status_code == 404
    gone = await auth_client.delete(f"{claim_url}/structures/{garage['id']}")
    assert gone.status_code == 204
    assert [s["name"] for s in (await auth_client.get(f"{claim_url}/structures")).json()] == [
        "House"
    ]


async def test_conflicts_and_bad_input(auth_client: httpx2.AsyncClient, claim_url: str) -> None:
    house = await post(auth_client, f"{claim_url}/structures", {"name": "Main house"})
    rooms = f"{claim_url}/structures/{house['id']}/rooms"
    await post(auth_client, rooms, {"name": "Kitchen"})

    taken = await auth_client.post(f"{claim_url}/structures", json={"name": "main house"})
    assert (taken.status_code, taken.json()["code"]) == (409, "name_taken")
    assert taken.json()["structure_id"] == house["id"]
    assert (await auth_client.post(rooms, json={"name": "KITCHEN"})).status_code == 409

    for body in [
        {"name": ""},
        {"name": "Hall", "length_ft": 0},
        {"name": "Hall", "width_ft": 1.005},
        {"name": "Hall", "floor_area_sqft": 100},
    ]:
        response = await auth_client.post(rooms, json=body)
        assert response.status_code == 422, body

    kitchen_id = (await auth_client.get(f"{claim_url}/structures")).json()[0]["rooms"][0]["id"]
    unknown = await auth_client.patch(
        f"{claim_url}/rooms/{kitchen_id}", json={"structure_id": str(uuid4())}
    )
    assert (unknown.status_code, unknown.json()["code"]) == (422, "unknown_structure")
    cleared = await auth_client.patch(f"{claim_url}/rooms/{kitchen_id}", json={"name": None})
    assert cleared.status_code == 422


async def test_roles(
    auth_client: httpx2.AsyncClient, client_for: ClientFor, claim_url: str
) -> None:
    technician = await client_for(Role.TECHNICIAN)
    viewer = await client_for(Role.VIEWER)

    house = await post(technician, f"{claim_url}/structures", {"name": "Main house"})
    kitchen = await post(technician, f"{claim_url}/structures/{house['id']}/rooms", {"name": "K"})

    assert (await viewer.get(f"{claim_url}/structures")).status_code == 200
    assert (await viewer.get(f"{claim_url}/rooms/{kitchen['id']}")).status_code == 200
    denied = await viewer.post(f"{claim_url}/structures", json={"name": "Garage"})
    assert denied.status_code == 403
    assert denied.json()["required_permission"] == "field_data:write"
    assert (await viewer.delete(f"{claim_url}/rooms/{kitchen['id']}")).status_code == 403


async def test_other_organizations_see_nothing(
    auth_client: httpx2.AsyncClient, client_for: ClientFor, claim_url: str
) -> None:
    house = await post(auth_client, f"{claim_url}/structures", {"name": "Main house"})
    kitchen = await post(auth_client, f"{claim_url}/structures/{house['id']}/rooms", {"name": "K"})
    outsider = await client_for(None)

    assert (await outsider.get(f"{claim_url}/structures")).status_code == 404
    assert (await outsider.get(f"{claim_url}/rooms/{kitchen['id']}")).status_code == 404
    assert (await outsider.post(f"{claim_url}/structures", json={"name": "X"})).status_code == 404


async def test_closed_claims_are_read_only(auth_client: httpx2.AsyncClient, claim_url: str) -> None:
    house = await post(auth_client, f"{claim_url}/structures", {"name": "Main house"})
    cancelled = await auth_client.post(
        f"{claim_url}/status", json={"status": "cancelled", "reason": "Duplicate"}
    )
    assert cancelled.status_code == 200, cancelled.text

    locked = await auth_client.post(
        f"{claim_url}/structures/{house['id']}/rooms", json={"name": "K"}
    )
    assert (locked.status_code, locked.json()["code"]) == (409, "claim_locked")
    assert (await auth_client.get(f"{claim_url}/structures")).status_code == 200


async def test_layout_changes_show_up_in_the_audit_timeline(
    auth_client: httpx2.AsyncClient, base: str, claim_url: str
) -> None:
    house = await post(auth_client, f"{claim_url}/structures", {"name": "Main house"})
    await post(auth_client, f"{claim_url}/structures/{house['id']}/rooms", {"name": "Kitchen"})

    rooms = await auth_client.get(f"{base}/audit-events", params={"entity_type": "room"})

    [created] = rooms.json()["items"]
    assert created["action"] == "room.created"
    assert created["actor"]["full_name"] == "Morgan Member"
    assert created["changes"]["name"] == [None, "Kitchen"]
