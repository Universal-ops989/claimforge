"""Moisture points: numbering, order, editing, and keeping drying records with their rooms."""

from typing import Any
from uuid import UUID

import httpx2
import pytest
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from tests.conftest import ClientFor
from tests.moisture.conftest import ADDRESS, Map, open_map

from claimforge_api.moisture import service
from claimforge_api.moisture.schemas import MoisturePointUpdate
from claimforge_api.structures import service as structures
from claimforge_api.users.models import Role


@pytest.mark.parametrize(
    ("labels", "following"),
    [([], "1"), (["1", "2", "7"], "8"), (["A", "3", "10"], "11"), (["A"], "1")],
)
def test_next_label(labels: list[str], following: str) -> None:
    assert service.next_label(labels) == following


async def test_numbering_and_order(moisture_map: Map) -> None:
    kitchen = await moisture_map.room("Kitchen")
    bath = await moisture_map.room("Bath")

    first = await moisture_map.point(kitchen)
    await moisture_map.point(bath)
    await moisture_map.point(kitchen, label="10")
    await moisture_map.point(kitchen, label="A")
    after_ten = await moisture_map.point(kitchen)

    assert (first.label, after_ten.label) == ("1", "11")
    # Room by room, then 1, 10, 11 in number order and letters last.
    assert await moisture_map.labels() == ["1", "10", "11", "A", "2"]
    with pytest.raises(service.LabelTakenError):
        await moisture_map.point(bath, label="a")  # labels ignore case


async def test_editing(moisture_map: Map) -> None:
    kitchen, bath = await moisture_map.room("Kitchen"), await moisture_map.room("Bath")
    point = await moisture_map.point(kitchen)
    other = await moisture_map.point(kitchen)

    moved = await moisture_map.edit(point, room_id=str(bath.id), label="1A", material="Plaster")
    assert (moved.room.name, moved.label, moved.material) == ("Bath", "1A", "Plaster")
    with pytest.raises(service.LabelTakenError):
        await moisture_map.edit(point, label=other.label)
    assert (await moisture_map.edit(point, label="1a")).label == "1a"  # its own, recased

    for fields in ({"scale": "reference"}, {"material": None}, {"label": " "}):
        with pytest.raises(ValidationError):
            MoisturePointUpdate.model_validate(fields)


async def test_rooms_must_be_on_the_claim(moisture_map: Map) -> None:
    elsewhere = await open_map(
        moisture_map.session, moisture_map.organization_id, moisture_map.user
    )
    their_room = await elsewhere.room("Garage")
    kitchen = await moisture_map.room("Kitchen")
    point = await moisture_map.point(kitchen)

    with pytest.raises(service.UnknownRoomError):
        await moisture_map.point(their_room)
    with pytest.raises(service.UnknownRoomError):
        await moisture_map.edit(point, room_id=str(their_room.id))


async def test_drying_records_keep_their_rooms(moisture_map: Map) -> None:
    house = await moisture_map.structure()
    kitchen = await moisture_map.room("Kitchen", house)
    point = await moisture_map.point(kitchen)
    session, org, claim_id, user = (
        moisture_map.session,
        moisture_map.organization_id,
        moisture_map.claim.id,
        moisture_map.user,
    )

    with pytest.raises(structures.HasMoisturePointsError) as caught:
        await structures.delete_room(session, org, claim_id, kitchen.id, user=user)
    assert caught.value.extra == {"moisture_points": 1}
    with pytest.raises(structures.HasMoisturePointsError):
        await structures.delete_structure(session, org, claim_id, house.id, user=user)

    await service.delete_point(session, org, claim_id, point.id, user=user)
    await structures.delete_structure(session, org, claim_id, house.id, user=user)


async def test_the_database_keeps_them_too(moisture_map: Map) -> None:
    kitchen = await moisture_map.room("Kitchen")
    await moisture_map.point(kitchen)

    await moisture_map.session.delete(kitchen)
    with pytest.raises(IntegrityError, match="fk_moisture_points_claim_id_rooms"):
        await moisture_map.session.flush()
    await moisture_map.session.rollback()


# ─── Over HTTP ────────────────────────────────────────────────────────────────


async def send(client: httpx2.AsyncClient, method: str, url: str, **body: Any) -> dict[str, Any]:
    response = await client.request(method, url, json=body or None)
    assert response.status_code < 300, response.text
    payload: dict[str, Any] = response.json() if response.content else {}
    return payload


async def test_over_http(
    auth_client: httpx2.AsyncClient, client_for: ClientFor, organization_id: UUID
) -> None:
    base = f"/v1/organizations/{organization_id}"
    claim = await send(
        auth_client, "POST", f"{base}/claims", loss_type="water", property={"address": ADDRESS}
    )
    url = f"{base}/claims/{claim['id']}"
    house = await send(auth_client, "POST", f"{url}/structures", name="House")
    kitchen = await send(
        auth_client, "POST", f"{url}/structures/{house['id']}/rooms", name="Kitchen"
    )
    bath = await send(auth_client, "POST", f"{url}/structures/{house['id']}/rooms", name="Bath")

    point = await send(
        auth_client,
        "POST",
        f"{url}/moisture-points",
        room_id=kitchen["id"],
        material="Subfloor",
        surface="floor",
        scale="percent",
    )
    assert (point["label"], point["room"]["name"], point["scale"]) == ("1", "Kitchen", "percent")
    await send(
        auth_client,
        "POST",
        f"{url}/moisture-points",
        room_id=bath["id"],
        material="Drywall",
        surface="wall",
        scale="reference",
    )
    in_kitchen = (
        await auth_client.get(f"{url}/moisture-points", params={"room_id": kitchen["id"]})
    ).json()
    assert [p["label"] for p in in_kitchen] == ["1"]

    await send(auth_client, "PATCH", f"{url}/moisture-points/{point['id']}", label="1A")
    refused = await auth_client.delete(f"{url}/rooms/{kitchen['id']}")
    assert (refused.status_code, refused.json()["code"]) == (409, "has_moisture_points")
    taken = await auth_client.patch(f"{url}/moisture-points/{point['id']}", json={"label": "2"})
    assert (taken.status_code, taken.json()["code"]) == (409, "label_taken")

    viewer = await client_for(Role.VIEWER)
    assert len((await viewer.get(f"{url}/moisture-points")).json()) == 2
    blocked = await viewer.post(
        f"{url}/moisture-points",
        json={"room_id": kitchen["id"], "material": "x", "surface": "wall", "scale": "percent"},
    )
    assert blocked.status_code == 403

    assert (await auth_client.delete(f"{url}/moisture-points/{point['id']}")).status_code == 204
    assert (await auth_client.get(f"{url}/moisture-points/{point['id']}")).status_code == 404
    timeline = (await auth_client.get(f"{url}/timeline", params={"kind": "moisture"})).json()
    assert [entry["summary"] for entry in timeline["items"]] == [
        "Deleted moisture point 1A",
        "Relabeled moisture point 1 as 1A",
        "Mapped moisture point 2 (Drywall, wall)",
        "Mapped moisture point 1 (Subfloor, floor)",
    ]
