"""The air on each visit: psychrometrics, where it's read, corrections, and kept evidence."""

from decimal import Decimal
from typing import Any
from uuid import UUID

import httpx2
import pytest
from pydantic import ValidationError
from sqlalchemy import select
from tests.conftest import ClientFor
from tests.moisture.conftest import ADDRESS, Map, open_map

from claimforge_api.equipment import placements
from claimforge_api.equipment import service as equipment
from claimforge_api.equipment.models import EquipmentPlacement
from claimforge_api.equipment.schemas import EquipmentCreate, PlacementCreate
from claimforge_api.moisture import psychrometrics, service
from claimforge_api.moisture.models import AtmosphericReading, MoistureLog
from claimforge_api.moisture.schemas import MoistureLogCreate, MoistureLogUpdate
from claimforge_api.structures import service as structures
from claimforge_api.structures.models import Room
from claimforge_api.users.models import Role

D = Decimal


# ─── Psychrometrics ───────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("temperature", "humidity", "grains", "dew_point"),
    [
        # Worked by hand from ASHRAE's saturation pressures at 20 °C and 30 °C.
        ("68", "50", "50.8", "48.7"),
        ("86", "50", "93.2", "65.2"),
        # Saturated air condenses at its own temperature.
        ("70", "100", "110.3", "70.0"),
    ],
)
def test_psychrometrics(temperature: str, humidity: str, grains: str, dew_point: str) -> None:
    assert psychrometrics.grains_per_pound(D(temperature), D(humidity)) == D(grains)
    assert psychrometrics.dew_point_f(D(temperature), D(humidity)) == D(dew_point)


def test_the_same_humidity_holds_more_water_in_warmer_air() -> None:
    cool, warm = (psychrometrics.grains_per_pound(D(t), D("50")) for t in ("60", "90"))
    assert warm > 2 * cool
    assert psychrometrics.grains_per_pound(D("75"), D("0")) == D("0.0")
    with pytest.raises(ValueError, match="no dew point"):
        psychrometrics.dew_point_f(D("75"), D("0"))


# ─── On visits ────────────────────────────────────────────────────────────────


class Job:
    def __init__(self, moisture_map: Map, kitchen: Room, dehu: EquipmentPlacement) -> None:
        self.map, self.kitchen, self.dehu = moisture_map, kitchen, dehu

    def air(self, location: str, temperature: str, humidity: str, **place: Any) -> dict[str, Any]:
        return {
            "location": location,
            "temperature_f": temperature,
            "relative_humidity": humidity,
            **place,
        }

    def everywhere(self) -> list[dict[str, Any]]:
        return [
            self.air("dehumidifier", "95", "20", placement_id=str(self.dehu.id)),
            self.air("room", "78", "65", room_id=str(self.kitchen.id)),
            self.air("unaffected", "72", "45"),
            self.air("outdoors", "88", "70"),
        ]

    async def log(self, **fields: Any) -> MoistureLog:
        return await service.create_log(
            self.map.session,
            self.map.organization_id,
            self.map.claim.id,
            MoistureLogCreate.model_validate(fields),
            user=self.map.user,
        )

    async def correct(self, visit: MoistureLog, **fields: Any) -> MoistureLog:
        return await service.update_log(
            self.map.session,
            self.map.organization_id,
            self.map.claim.id,
            visit.id,
            MoistureLogUpdate.model_validate(fields),
            user=self.map.user,
        )


async def unit(moisture_map: Map, tag: str, kind: str = "dehumidifier") -> UUID:
    made = await equipment.create_equipment(
        moisture_map.session,
        moisture_map.organization_id,
        EquipmentCreate.model_validate({"kind": kind, "name": "Unit", "asset_tag": tag}),
        user=moisture_map.user,
    )
    return made.id


async def place(moisture_map: Map, unit_id: UUID, room: Room) -> EquipmentPlacement:
    return await placements.place(
        moisture_map.session,
        moisture_map.organization_id,
        moisture_map.claim.id,
        PlacementCreate(equipment_id=unit_id, room_id=room.id),
        user=moisture_map.user,
    )


@pytest.fixture
async def job(moisture_map: Map) -> Job:
    kitchen = await moisture_map.room("Kitchen")
    dehu = await place(moisture_map, await unit(moisture_map, "D-12"), kitchen)
    return Job(moisture_map, kitchen, dehu)


async def test_a_visit_can_be_all_air(job: Job) -> None:
    visit = await job.log(atmosphere=job.everywhere(), notes="Day 0 baseline")

    shown = service.present_log(visit)
    assert shown.readings == []
    assert [(a.location, a.grains_per_pound) for a in shown.atmosphere] == [
        ("outdoors", psychrometrics.grains_per_pound(D("88"), D("70"))),
        ("unaffected", psychrometrics.grains_per_pound(D("72"), D("45"))),
        ("room", psychrometrics.grains_per_pound(D("78"), D("65"))),
        ("dehumidifier", psychrometrics.grains_per_pound(D("95"), D("20"))),
    ]
    room, dehu = shown.atmosphere[2], shown.atmosphere[3]
    assert room.room is not None
    assert room.room.name == "Kitchen"
    assert dehu.dehumidifier is not None
    assert dehu.dehumidifier.asset_tag == "D-12"
    assert dehu.dew_point_f == psychrometrics.dew_point_f(D("95"), D("20"))


def test_where_the_air_is_read() -> None:
    nowhere: list[dict[str, Any]] = [
        {},  # no readings of either kind
        {"atmosphere": [{"location": "room", "temperature_f": 70, "relative_humidity": 50}]},
        {
            "atmosphere": [
                {
                    "location": "outdoors",
                    "room_id": "0192f3a4-5b6c-7d8e-9f01-000000000001",
                    "temperature_f": 70,
                    "relative_humidity": 50,
                }
            ]
        },
        {
            "atmosphere": [{"location": "outdoors", "temperature_f": 70, "relative_humidity": 50}]
            * 2
        },
        {"atmosphere": [{"location": "outdoors", "temperature_f": 70, "relative_humidity": 101}]},
        {"atmosphere": [{"location": "outdoors", "temperature_f": 200, "relative_humidity": 50}]},
    ]
    for body in nowhere:
        with pytest.raises(ValidationError):
            MoistureLogCreate.model_validate(body)


async def test_rooms_and_dehumidifiers_must_be_on_the_claim(job: Job) -> None:
    elsewhere = await open_map(job.map.session, job.map.organization_id, job.map.user)
    their_room = await elsewhere.room("Garage")
    mover = await place(job.map, await unit(job.map, "AM-1", "air_mover"), job.kitchen)

    with pytest.raises(service.UnknownRoomError):
        await job.log(atmosphere=[job.air("room", "70", "50", room_id=str(their_room.id))])
    with pytest.raises(service.UnknownDehumidifierError) as caught:
        await job.log(atmosphere=[job.air("dehumidifier", "70", "50", placement_id=str(mover.id))])
    assert caught.value.extra == {"placement_ids": [str(mover.id)]}


async def test_correcting_the_air(job: Job) -> None:
    point = await job.map.point(job.kitchen)
    visit = await job.log(
        readings=[{"point_id": str(point.id), "value": "30"}], atmosphere=job.everywhere()
    )

    same = await job.correct(visit, atmosphere=job.everywhere())
    assert same.readings_edited_at is None  # nothing changed

    fixed = await job.correct(
        visit,
        atmosphere=[
            job.air("room", "76", "60", room_id=str(job.kitchen.id)),  # re-read
            job.air("outdoors", "88", "70"),
        ],
    )
    shown = service.present_log(fixed)
    assert [(a.location, a.temperature_f) for a in shown.atmosphere] == [
        ("outdoors", D("88.0")),
        ("room", D("76.0")),
    ]
    assert shown.readings_edited_at is not None

    # The moisture reading alone keeps the visit; then nothing would.
    await job.correct(visit, atmosphere=[])
    with pytest.raises(service.NoReadingsError):
        await job.correct(visit, readings=[{"point_id": str(point.id), "value": None}])


async def test_air_readings_are_kept_with_their_room(job: Job) -> None:
    await job.log(atmosphere=[job.air("room", "78", "65", room_id=str(job.kitchen.id))])
    await placements.delete_placement(
        job.map.session, job.map.organization_id, job.map.claim.id, job.dehu.id, user=job.map.user
    )

    with pytest.raises(structures.HasAtmosphericReadingsError):
        await structures.delete_room(
            job.map.session,
            job.map.organization_id,
            job.map.claim.id,
            job.kitchen.id,
            user=job.map.user,
        )


async def test_a_mistaken_placement_takes_its_exhaust_readings(job: Job) -> None:
    await job.log(atmosphere=job.everywhere())

    await placements.delete_placement(
        job.map.session, job.map.organization_id, job.map.claim.id, job.dehu.id, user=job.map.user
    )

    left = list(await job.map.session.scalars(select(AtmosphericReading.location)))
    assert sorted(left) == ["outdoors", "room", "unaffected"]


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

    visit = await send(
        auth_client,
        "POST",
        f"{url}/moisture-logs",
        atmosphere=[
            {"location": "outdoors", "temperature_f": 86, "relative_humidity": 50},
            {"location": "unaffected", "temperature_f": 68, "relative_humidity": 50},
        ],
    )
    assert [
        (a["location"], a["grains_per_pound"], a["dew_point_f"]) for a in visit["atmosphere"]
    ] == [
        ("outdoors", 93.2, 65.2),
        ("unaffected", 50.8, 48.7),
    ]
    missing = await auth_client.post(
        f"{url}/moisture-logs",
        json={"atmosphere": [{"location": "room", "temperature_f": 70, "relative_humidity": 50}]},
    )
    assert missing.status_code == 422

    timeline = (await auth_client.get(f"{url}/timeline", params={"kind": "moisture"})).json()
    assert [entry["summary"] for entry in timeline["items"]] == ["Logged moisture readings"]
    viewer = await client_for(Role.VIEWER)
    assert (await viewer.get(f"{url}/moisture-logs/{visit['id']}")).status_code == 200
