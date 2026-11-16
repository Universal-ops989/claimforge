"""The equipment inventory: adding units, unique asset tags, finding, editing, access."""

from typing import Any
from uuid import UUID

import httpx2
import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from tests.conftest import ClientFor

from claimforge_api.equipment.models import Equipment, EquipmentKind
from claimforge_api.users.models import Role


@pytest.fixture
def url(organization_id: UUID) -> str:
    return f"/v1/organizations/{organization_id}/equipment"


async def add(client: httpx2.AsyncClient, url: str, **fields: Any) -> dict[str, Any]:
    body = {"kind": "dehumidifier", "name": "Phoenix 200 MAX", "asset_tag": "D-12"} | fields
    response = await client.post(url, json=body)
    assert response.status_code == 201, response.text
    payload: dict[str, Any] = response.json()
    return payload


async def tags(client: httpx2.AsyncClient, url: str, **params: Any) -> list[str]:
    response = await client.get(url, params=params)
    assert response.status_code == 200, response.text
    return [unit["asset_tag"] for unit in response.json()["items"]]


async def test_adding_equipment(auth_client: httpx2.AsyncClient, url: str) -> None:
    dehu = await add(auth_client, url, capacity=130, serial_number=" PX-998812 ")

    assert dehu["kind"] == "dehumidifier"
    assert (dehu["capacity"], dehu["capacity_unit"]) == (130, "pints_per_day")
    assert (dehu["serial_number"], dehu["status"]) == ("PX-998812", "in_service")
    mover = await add(auth_client, url, kind="air_mover", name="Velo Pro", asset_tag="AM-1")
    assert (mover["capacity"], mover["capacity_unit"]) == (None, "cfm")
    other = await add(auth_client, url, kind="other", name="Hydroxyl", asset_tag="HX-1")
    assert other["capacity_unit"] is None


async def test_asset_tags_are_unique(auth_client: httpx2.AsyncClient, url: str) -> None:
    first = await add(auth_client, url)
    await add(auth_client, url, asset_tag="D-13")

    for attempt in (
        auth_client.post(url, json={"kind": "heater", "name": "X", "asset_tag": "d-12"}),
        auth_client.patch(f"{url}/{first['id']}", json={"asset_tag": "D-13"}),
    ):
        response = await attempt
        assert (response.status_code, response.json()["code"]) == (409, "asset_tag_taken")
    # Its own tag in other letters is fine.
    recased = await auth_client.patch(f"{url}/{first['id']}", json={"asset_tag": "d-12"})
    assert recased.json()["asset_tag"] == "d-12"


async def test_the_database_keeps_tags_unique(
    db_session: AsyncSession, organization_id: UUID
) -> None:
    for tag in ("D-12", "d-12"):
        db_session.add(
            Equipment(
                organization_id=organization_id,
                kind=EquipmentKind.HEATER,
                name="Heater",
                asset_tag=tag,
            )
        )
    with pytest.raises(IntegrityError, match="uq_equipment_organization_id_asset_tag"):
        await db_session.flush()
    await db_session.rollback()


async def test_finding_equipment(auth_client: httpx2.AsyncClient, url: str) -> None:
    await add(auth_client, url, asset_tag="D-12", serial_number="PX-1")
    await add(auth_client, url, asset_tag="D-07", name="Dri-Eaz LGR 3500i")
    await add(auth_client, url, kind="air_mover", name="Velo Pro", asset_tag="AM-1")
    scrubber = await add(auth_client, url, kind="air_scrubber", name="HEPA 500", asset_tag="S-1")
    await auth_client.patch(f"{url}/{scrubber['id']}", json={"status": "maintenance"})

    assert await tags(auth_client, url) == ["AM-1", "D-07", "D-12", "S-1"]
    assert await tags(auth_client, url, kind="dehumidifier") == ["D-07", "D-12"]
    assert await tags(auth_client, url, status="maintenance") == ["S-1"]
    assert await tags(auth_client, url, q="lgr") == ["D-07"]
    assert await tags(auth_client, url, q="px-1") == ["D-12"]
    page = (await auth_client.get(url, params={"limit": 3})).json()
    assert (len(page["items"]), page["has_more"]) == (3, True)


async def test_editing_and_deleting(auth_client: httpx2.AsyncClient, url: str) -> None:
    unit = await add(auth_client, url, capacity=130)

    edited = await auth_client.patch(
        f"{url}/{unit['id']}", json={"status": "retired", "capacity": None, "notes": "Compressor"}
    )
    assert (edited.json()["status"], edited.json()["capacity"]) == ("retired", None)
    for body in ({"name": None}, {"status": None}, {"capacity": 0}, {"kind": "fan"}):
        response = await auth_client.patch(f"{url}/{unit['id']}", json=body)
        assert response.status_code == 422, body

    assert (await auth_client.delete(f"{url}/{unit['id']}")).status_code == 204
    assert (await auth_client.get(f"{url}/{unit['id']}")).status_code == 404


async def test_access(auth_client: httpx2.AsyncClient, client_for: ClientFor, url: str) -> None:
    unit = await add(auth_client, url)
    viewer = await client_for(Role.VIEWER)
    technician = await client_for(Role.TECHNICIAN)
    outsider = await client_for(None)

    assert (await viewer.get(f"{url}/{unit['id']}")).status_code == 200
    refused = await viewer.post(url, json={"kind": "heater", "name": "X", "asset_tag": "H-1"})
    assert refused.status_code == 403
    await add(technician, url, kind="heater", name="TES 1", asset_tag="H-1")
    assert (await outsider.get(url)).status_code == 404
