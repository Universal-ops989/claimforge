"""Monitoring visits: readings, corrections, the drying log, and what the history shows."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

import httpx2
import pytest
from pydantic import ValidationError
from sqlalchemy import func, select
from tests.conftest import ClientFor
from tests.moisture.conftest import ADDRESS, Map, open_map

from claimforge_api.audit.models import AuditEvent
from claimforge_api.core.errors import PermissionDeniedError
from claimforge_api.moisture import service
from claimforge_api.moisture.models import MoistureLog, MoisturePoint, MoistureReading
from claimforge_api.moisture.schemas import (
    DryingLogQuery,
    MoistureLogCreate,
    MoistureLogUpdate,
)
from claimforge_api.structures.models import Room
from claimforge_api.users import service as users
from claimforge_api.users.models import Membership, Role


async def log(moisture_map: Map, values: dict[MoisturePoint, str], **fields: Any) -> MoistureLog:
    body = {"readings": [{"point_id": str(p.id), "value": v} for p, v in values.items()]}
    return await service.create_log(
        moisture_map.session,
        moisture_map.organization_id,
        moisture_map.claim.id,
        MoistureLogCreate.model_validate(body | fields),
        user=moisture_map.user,
    )


async def correct(moisture_map: Map, visit: MoistureLog, **fields: Any) -> MoistureLog:
    return await service.update_log(
        moisture_map.session,
        moisture_map.organization_id,
        moisture_map.claim.id,
        visit.id,
        MoistureLogUpdate.model_validate(fields),
        user=moisture_map.user,
    )


async def table(moisture_map: Map, room: Room | None = None) -> dict[str, Any]:
    drying = await service.drying_log(
        moisture_map.session,
        moisture_map.organization_id,
        moisture_map.claim.id,
        DryingLogQuery(room_id=room.id if room else None),
        user=moisture_map.user,
    )
    return drying.model_dump(mode="json")


class Site:
    def __init__(self, moisture_map: Map, kitchen: Room, bath: Room, points: list[MoisturePoint]):
        self.map, self.kitchen, self.bath = moisture_map, kitchen, bath
        self.p1, self.p2, self.p3 = points


@pytest.fixture
async def site(moisture_map: Map) -> Site:
    kitchen, bath = await moisture_map.room("Kitchen"), await moisture_map.room("Bath")
    points = [
        await moisture_map.point(kitchen),
        await moisture_map.point(kitchen, material="Subfloor", surface="floor"),
        await moisture_map.point(bath, scale="reference"),
    ]
    return Site(moisture_map, kitchen, bath, points)


async def test_logging_a_visit(site: Site) -> None:
    before = datetime.now(UTC)
    visit = await log(site.map, {site.p2: "24.5", site.p1: "31"}, notes="Dehus running")

    shown = service.present_log(visit)
    assert [(r.label, r.value) for r in shown.readings] == [
        ("1", Decimal("31.0")),
        ("2", Decimal("24.5")),
    ]
    assert shown.taken_by is not None
    assert shown.taken_by.full_name == "Morgan Member"
    assert before <= shown.taken_at <= datetime.now(UTC)
    assert (shown.notes, shown.readings_edited_at) == ("Dehus running", None)


async def test_when_readings_were_taken(site: Site) -> None:
    yesterday = datetime.now(UTC) - timedelta(days=1)
    late = await log(site.map, {site.p1: "30"}, taken_at=yesterday.isoformat())
    assert late.taken_at == yesterday

    soon = datetime.now(UTC) + timedelta(minutes=5)  # a device clock a little ahead
    await log(site.map, {site.p1: "29"}, taken_at=soon.isoformat())
    with pytest.raises(service.TakenInFutureError):
        await log(site.map, {site.p1: "28"}, taken_at=(soon + timedelta(hours=1)).isoformat())


async def test_points_must_be_on_the_claim(site: Site) -> None:
    elsewhere = await open_map(site.map.session, site.map.organization_id, site.map.user)
    their_point = await elsewhere.point(await elsewhere.room("Garage"))

    with pytest.raises(service.UnknownPointError) as caught:
        await log(site.map, {site.p1: "30", their_point: "12"})
    assert caught.value.extra == {"point_ids": [str(their_point.id)]}

    twice = {"readings": [{"point_id": str(site.p1.id), "value": v} for v in ("1", "2")]}
    with pytest.raises(ValidationError, match="once per visit"):
        MoistureLogCreate.model_validate(twice)
    for value in ("-1", "18.25", "10000"):
        with pytest.raises(ValidationError):
            MoistureLogCreate.model_validate(
                {"readings": [{"point_id": str(site.p1.id), "value": value}]}
            )


async def test_corrections(site: Site) -> None:
    visit = await log(site.map, {site.p1: "30", site.p2: "22"})

    noted = await correct(site.map, visit, notes="Moved the dehu")
    assert noted.readings_edited_at is None  # notes aren't readings

    fixed = await correct(
        site.map,
        visit,
        readings=[
            {"point_id": str(site.p1.id), "value": "20"},  # mistyped
            {"point_id": str(site.p2.id), "value": None},  # wasn't actually read
            {"point_id": str(site.p3.id), "value": "140"},  # forgotten
        ],
    )
    shown = service.present_log(fixed)
    assert [(r.label, r.value) for r in shown.readings] == [
        ("1", Decimal("20.0")),
        ("3", Decimal("140.0")),
    ]
    assert shown.readings_edited_at is not None

    # The same values again change nothing.
    again = await correct(site.map, visit, readings=[{"point_id": str(site.p1.id), "value": "20"}])
    assert again.readings_edited_at == shown.readings_edited_at
    with pytest.raises(service.NoReadingsError):
        await correct(
            site.map,
            visit,
            readings=[{"point_id": str(p.id), "value": None} for p in (site.p1, site.p3)],
        )
    with pytest.raises(ValidationError):
        MoistureLogUpdate.model_validate({"taken_at": None})


async def test_every_reading_is_audited(site: Site) -> None:
    visit = await log(site.map, {site.p1: "30", site.p2: "22"})
    await correct(site.map, visit, readings=[{"point_id": str(site.p1.id), "value": "25"}])

    actions = list(
        await site.map.session.scalars(
            select(AuditEvent.action).where(
                AuditEvent.claim_id == site.map.claim.id,
                AuditEvent.entity_type == "moisture_reading",
            )
        )
    )
    assert sorted(actions) == [
        "moisture_reading.created",
        "moisture_reading.created",
        "moisture_reading.updated",
    ]


async def test_the_drying_log(site: Site) -> None:
    day = datetime.now(UTC) - timedelta(days=3)
    second = await log(
        site.map, {site.p1: "25", site.p3: "160"}, taken_at=(day + timedelta(days=1)).isoformat()
    )
    # Entered last, taken first: the table follows when readings were taken.
    first = await log(
        site.map, {site.p1: "31", site.p2: "28", site.p3: "190"}, taken_at=day.isoformat()
    )
    third = await log(site.map, {site.p2: "19"}, taken_at=(day + timedelta(days=2)).isoformat())

    everything = await table(site.map)
    assert [v["id"] for v in everything["visits"]] == [str(first.id), str(second.id), str(third.id)]
    assert [(r["name"], [p["label"] for p in r["points"]]) for r in everything["rooms"]] == [
        ("Kitchen", ["1", "2"]),
        ("Bath", ["3"]),
    ]
    rows = [p["values"] for r in everything["rooms"] for p in r["points"]]
    assert rows == [[31.0, 25.0, None], [28.0, None, 19.0], [190.0, 160.0, None]]

    # One room: only the visits that read it.
    bath = await table(site.map, site.bath)
    assert [v["id"] for v in bath["visits"]] == [str(first.id), str(second.id)]
    assert bath["rooms"][0]["points"][0]["values"] == [190.0, 160.0]
    assert (await table(site.map, await site.map.room("Attic"))) == {
        "visits": [],
        "rooms": [],
        "atmosphere": [],
    }


async def test_deleting_points_and_visits(site: Site) -> None:
    visit = await log(site.map, {site.p1: "30", site.p3: "150"})
    other = await log(site.map, {site.p3: "120"})
    session, org, claim_id, user = (
        site.map.session,
        site.map.organization_id,
        site.map.claim.id,
        site.map.user,
    )

    await service.delete_point(session, org, claim_id, site.p3.id, user=user)
    remaining = list(await session.scalars(select(MoistureReading.point_id)))
    assert remaining == [site.p1.id]
    # The visit that only read point 3 has no readings left to show.
    assert [v["id"] for v in (await table(site.map))["visits"]] == [str(visit.id)]

    await service.delete_log(session, org, claim_id, visit.id, user=user)
    count = await session.scalar(select(func.count()).select_from(MoistureReading))
    assert count == 0
    deleted = await session.scalar(
        select(func.count()).where(AuditEvent.action == "moisture_reading.deleted")
    )
    assert deleted == 3
    await service.delete_log(session, org, claim_id, other.id, user=user)


async def test_access(site: Site) -> None:
    await log(site.map, {site.p1: "30"})
    viewer = await users.create_user(site.map.session, email="viewer@example.com", full_name="V")
    site.map.session.add(
        Membership(organization_id=site.map.organization_id, user_id=viewer.id, role=Role.VIEWER)
    )
    await site.map.session.commit()
    as_viewer = Map(site.map.session, site.map.organization_id, site.map.claim, viewer)

    assert len((await table(as_viewer))["visits"]) == 1
    with pytest.raises(PermissionDeniedError):
        await log(as_viewer, {site.p1: "1"})


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
    point = await send(
        auth_client,
        "POST",
        f"{url}/moisture-points",
        room_id=kitchen["id"],
        material="Drywall",
        surface="wall",
        scale="percent",
    )

    visit = await send(
        auth_client,
        "POST",
        f"{url}/moisture-logs",
        readings=[{"point_id": point["id"], "value": 18.5}],
    )
    assert visit["readings"] == [{"point_id": point["id"], "label": "1", "value": 18.5}]
    await send(auth_client, "PATCH", f"{url}/moisture-logs/{visit['id']}", notes="Day 2")
    await send(
        auth_client,
        "PATCH",
        f"{url}/moisture-logs/{visit['id']}",
        readings=[{"point_id": point["id"], "value": 16}],
    )
    drying = await send(auth_client, "GET", f"{url}/drying-log")
    assert drying["rooms"][0]["points"][0]["values"] == [16.0]
    listed = await send(auth_client, "GET", f"{url}/moisture-logs")
    assert [v["id"] for v in listed["items"]] == [visit["id"]]

    future = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    ahead = await auth_client.post(
        f"{url}/moisture-logs",
        json={"taken_at": future, "readings": [{"point_id": point["id"], "value": 1}]},
    )
    assert (ahead.status_code, ahead.json()["code"]) == (422, "taken_in_future")
    viewer = await client_for(Role.VIEWER)
    assert (await viewer.get(f"{url}/drying-log")).status_code == 200

    assert (await auth_client.delete(f"{url}/moisture-logs/{visit['id']}")).status_code == 204
    timeline = (await auth_client.get(f"{url}/timeline", params={"kind": "moisture"})).json()
    # One entry per visit, not one per reading.
    assert [entry["summary"] for entry in timeline["items"]] == [
        "Deleted moisture readings",
        "Corrected moisture readings",
        "Updated moisture readings: notes",
        "Logged moisture readings",
        "Mapped moisture point 1 (Drywall, wall)",
    ]
