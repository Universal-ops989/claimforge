"""Placing equipment on jobs: one place at a time, removal, corrections, days, history."""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import httpx2
import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from tests.conftest import ClientFor

from claimforge_api.equipment.models import EquipmentPlacement, equipment_days
from claimforge_api.users.models import Role

ADDRESS = {"line1": "123 Main St", "city": "Austin", "region": "TX", "postal_code": "78701"}
NOW = datetime(2026, 11, 16, 12, 0, tzinfo=UTC)


@pytest.mark.parametrize(
    ("elapsed", "days"),
    [
        (timedelta(0), 1),
        (timedelta(hours=3), 1),
        (timedelta(hours=24), 1),
        (timedelta(hours=24, seconds=1), 2),
        (timedelta(days=3), 3),
        (timedelta(days=3, minutes=1), 4),
    ],
)
def test_billable_days(elapsed: timedelta, days: int) -> None:
    assert equipment_days(NOW, NOW + elapsed) == days


async def send(
    client: httpx2.AsyncClient, method: str, url: str, expect: int = 0, **body: Any
) -> Any:
    response = await client.request(method, url, json=body if body else None)
    if expect:
        assert response.status_code == expect, response.text
    else:
        assert response.status_code < 300, response.text
    return response.json() if response.content else None


def ago(**delta: float) -> str:
    return (datetime.now(UTC) - timedelta(**delta)).isoformat()


class Job:
    """A claim with two rooms, and the organization's equipment."""

    def __init__(self, client: httpx2.AsyncClient, base: str) -> None:
        self.client, self.base = client, base

    async def open(self) -> "Job":
        claim = await send(
            self.client,
            "POST",
            f"{self.base}/claims",
            loss_type="water",
            property={"address": ADDRESS},
        )
        self.claim = claim
        self.url = f"{self.base}/claims/{claim['id']}"
        house = await send(self.client, "POST", f"{self.url}/structures", name="House")
        rooms = f"{self.url}/structures/{house['id']}/rooms"
        self.kitchen = await send(self.client, "POST", rooms, name="Kitchen")
        self.bath = await send(self.client, "POST", rooms, name="Bath")
        return self

    async def unit(self, tag: str, kind: str = "dehumidifier", **fields: Any) -> dict[str, Any]:
        unit: dict[str, Any] = await send(
            self.client,
            "POST",
            f"{self.base}/equipment",
            kind=kind,
            name="Unit",
            asset_tag=tag,
            **fields,
        )
        return unit

    async def place(
        self, unit: dict[str, Any], room: dict[str, Any] | None = None, expect: int = 0, **f: Any
    ) -> Any:
        return await send(
            self.client,
            "POST",
            f"{self.url}/equipment-placements",
            expect,
            equipment_id=unit["id"],
            room_id=(room or self.kitchen)["id"],
            **f,
        )

    async def remove(self, placement: dict[str, Any], expect: int = 0, **f: Any) -> Any:
        url = f"{self.url}/equipment-placements/{placement['id']}/remove"
        response = await self.client.post(url, json=f)
        assert response.status_code == (expect or 200), response.text
        return response.json()


@pytest.fixture
async def job(auth_client: httpx2.AsyncClient, organization_id: UUID) -> Job:
    return await Job(auth_client, f"/v1/organizations/{organization_id}").open()


async def test_placing_and_removing(job: Job) -> None:
    unit = await job.unit("D-12")
    placement = await job.place(unit, placed_at=ago(days=2, hours=1))
    assert (placement["running"], placement["days"]) == (True, 3)
    assert placement["equipment"]["asset_tag"] == "D-12"
    assert placement["room"]["name"] == "Kitchen"
    assert placement["placed_by"]["full_name"] == "Morgan Member"

    on_site = await send(job.client, "GET", f"{job.base}/equipment/{unit['id']}")
    assert on_site["current_placement"]["claim"]["number"] == job.claim["number"]
    busy = await job.client.get(f"{job.base}/equipment", params={"available": "true"})
    assert busy.json()["items"] == []

    removed = await job.remove(placement, removed_at=ago(days=1))
    assert (removed["running"], removed["days"]) == (False, 2)
    assert removed["removed_by"]["full_name"] == "Morgan Member"
    back = await send(job.client, "GET", f"{job.base}/equipment/{unit['id']}")
    assert back["current_placement"] is None
    free = await job.client.get(f"{job.base}/equipment", params={"available": "true"})
    assert [u["asset_tag"] for u in free.json()["items"]] == ["D-12"]


async def test_one_place_at_a_time(
    job: Job, auth_client: httpx2.AsyncClient, organization_id: UUID
) -> None:
    unit = await job.unit("D-12")
    await job.place(unit)
    other = await Job(auth_client, job.base).open()

    refused = await other.place(unit, expect=409)
    assert refused["code"] == "equipment_running"
    assert refused["claim_number"] == job.claim["number"]
    broken = await job.unit("D-13", status="maintenance")
    unavailable = await job.place(broken, expect=409)
    assert (unavailable["code"], unavailable["equipment_status"]) == (
        "equipment_unavailable",
        "maintenance",
    )


async def test_the_database_keeps_units_in_one_place(
    db_session: AsyncSession, job: Job, organization_id: UUID
) -> None:
    unit = await job.unit("D-12")
    for room in (job.kitchen, job.bath):
        db_session.add(
            EquipmentPlacement(
                organization_id=organization_id,
                claim_id=UUID(job.claim["id"]),
                room_id=UUID(room["id"]),
                equipment_id=UUID(unit["id"]),
                kind="dehumidifier",
                asset_tag="D-12",
                placed_at=datetime.now(UTC),
            )
        )
    with pytest.raises(IntegrityError, match="uq_equipment_placements_running"):
        await db_session.flush()
    await db_session.rollback()


async def test_times(job: Job) -> None:
    unit = await job.unit("D-12")
    tomorrow = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    assert (await job.place(unit, expect=422, placed_at=tomorrow))["code"] == "time_in_future"

    placement = await job.place(unit, placed_at=ago(hours=5))
    early = await job.remove(placement, expect=422, removed_at=ago(hours=6))
    assert early["code"] == "removed_before_placed"
    await job.remove(placement)
    assert (await job.remove(placement, expect=409))["code"] == "already_removed"


async def test_closed_claims_can_still_be_emptied(job: Job) -> None:
    running = await job.place(await job.unit("D-12"))
    await send(
        job.client, "POST", f"{job.url}/status", status="cancelled", reason="Duplicate claim"
    )

    assert (await job.place(await job.unit("D-13"), expect=409))["code"] == "claim_locked"
    pulled = await job.remove(running)
    assert pulled["running"] is False


async def test_corrections(job: Job, auth_client: httpx2.AsyncClient) -> None:
    unit = await job.unit("D-12")
    placement = await job.place(unit)
    edit = f"{job.url}/equipment-placements/{placement['id']}"

    moved = await send(job.client, "PATCH", edit, room_id=job.bath["id"])
    assert moved["room"]["name"] == "Bath"
    other = await Job(auth_client, job.base).open()
    wrong = await send(job.client, "PATCH", edit, 422, room_id=other.kitchen["id"])
    assert wrong["code"] == "unknown_room"

    await job.remove(placement)
    await other.place(unit)  # now running elsewhere
    reopened = await send(job.client, "PATCH", edit, 409, removed_at=None)
    assert reopened["code"] == "equipment_running"


async def test_equipment_days(job: Job) -> None:
    first = await job.place(await job.unit("D-1"), placed_at=ago(days=4, hours=2))
    await job.remove(first, removed_at=ago(days=2))  # 2 days 2 hours: 3 days
    await job.place(await job.unit("D-2"), placed_at=ago(hours=30))  # running: 2 days
    await job.place(await job.unit("AM-1", kind="air_mover"), placed_at=ago(hours=2))

    days = await send(job.client, "GET", f"{job.url}/equipment-days")
    assert days == [
        {"kind": "dehumidifier", "placements": 2, "running": 1, "days": 5},
        {"kind": "air_mover", "placements": 1, "running": 1, "days": 1},
    ]
    running = await job.client.get(f"{job.url}/equipment-placements", params={"running": "true"})
    assert [p["equipment"]["asset_tag"] for p in running.json()] == ["D-2", "AM-1"]


async def test_history_is_kept(job: Job) -> None:
    unit = await job.unit("D-12")
    placement = await job.place(unit)

    kept = await send(job.client, "DELETE", f"{job.base}/equipment/{unit['id']}", 409)
    assert kept["code"] == "equipment_has_history"
    room = await send(job.client, "DELETE", f"{job.url}/rooms/{job.kitchen['id']}", 409)
    assert (room["code"], room["equipment_placements"]) == ("has_equipment_placements", 1)

    await send(job.client, "DELETE", f"{job.url}/equipment-placements/{placement['id']}", 204)
    await send(job.client, "DELETE", f"{job.url}/rooms/{job.kitchen['id']}", 204)
    await send(job.client, "DELETE", f"{job.base}/equipment/{unit['id']}", 204)


async def test_timeline_and_access(job: Job, client_for: ClientFor) -> None:
    unit = await job.unit("D-12")
    placement = await job.place(unit, placed_at=ago(days=2, hours=12))
    await send(
        job.client,
        "PATCH",
        f"{job.url}/equipment-placements/{placement['id']}",
        room_id=job.bath["id"],
    )
    await job.remove(placement)

    timeline = await send(job.client, "GET", f"{job.url}/timeline?kind=equipment")
    assert [entry["summary"] for entry in timeline["items"]] == [
        "Removed dehumidifier D-12 after 3 days",
        "Moved dehumidifier D-12 to another room",
        "Placed dehumidifier D-12",
    ]

    viewer = await client_for(Role.VIEWER)
    assert len((await viewer.get(f"{job.url}/equipment-placements")).json()) == 1
    refused = await viewer.post(
        f"{job.url}/equipment-placements",
        json={"equipment_id": unit["id"], "room_id": job.kitchen["id"]},
    )
    assert refused.status_code == 403
