"""Drying alerts: each rule on plain data, then a whole job through the API."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

import httpx2
import pytest
from tests.moisture.conftest import ADDRESS, Map

from claimforge_api.equipment import placements
from claimforge_api.equipment import service as equipment
from claimforge_api.equipment.schemas import EquipmentCreate, PlacementCreate
from claimforge_api.moisture import alerts, service
from claimforge_api.moisture.alerts import AlertKind
from claimforge_api.moisture.schemas import MoistureLogCreate

D = Decimal
NOW = datetime(2026, 11, 16, 12, tzinfo=UTC)
KITCHEN, BATH = uuid4(), uuid4()


def point(*values: str, goal: str | None = "15", room: UUID = KITCHEN) -> alerts.Point:
    """Readings a day apart, the last one a day before NOW."""
    start = NOW - timedelta(days=len(values))
    readings = [(start + timedelta(days=n), D(v)) for n, v in enumerate(values)]
    return alerts.Point(uuid4(), "1", room, D(goal) if goal else None, readings)


@pytest.mark.parametrize(
    ("values", "goal", "is_stalled"),
    [
        (("30", "28", "28", "29"), "15", True),  # flat, then worse
        (("30", "25", "20"), "15", False),  # improving
        (("30", "30"), "15", False),  # too few readings to say
        (("30", "14", "14"), "15", False),  # dry
        (("30", "30", "30"), None, False),  # no goal: its own alert
    ],
)
def test_stalled(values: tuple[str, ...], goal: str | None, is_stalled: bool) -> None:
    assert alerts.stalled(point(*values, goal=goal)) is is_stalled


def test_a_room_is_dry_when_every_point_is() -> None:
    dry = point("30", "14")
    also_dry = point("30", "20", "15")
    assert alerts.dry_rooms([dry, also_dry]) == {KITCHEN: also_dry.readings[-1][0]}
    assert alerts.dry_rooms([dry, point("30", "20")]) == {}
    assert alerts.dry_rooms([dry, point("30", goal=None)]) == {}  # can't tell without a goal


def kinds(found: list[alerts.Alert]) -> list[AlertKind]:
    return [a.kind for a in found]


def test_monitoring_gap() -> None:
    drying = [point("30", "25")]
    late = alerts.alerts(drying, [], NOW - timedelta(hours=25), now=NOW)
    assert kinds(late) == [AlertKind.MONITORING_GAP]
    assert late[0].extra == {"hours": 25, "drying_points": 1}
    assert alerts.alerts(drying, [], NOW - timedelta(hours=23), now=NOW) == []
    # Nothing left drying: nothing to monitor.
    assert alerts.alerts([point("30", "14")], [], NOW - timedelta(days=5), now=NOW) == []


def test_equipment_in_a_dry_room() -> None:
    dried = point("30", "14")
    unit = alerts.Running(uuid4(), "D-12", KITCHEN, NOW - timedelta(days=5))
    elsewhere = alerts.Running(uuid4(), "D-13", BATH, NOW - timedelta(days=5))

    [found] = alerts.alerts([dried, point("30", "25", room=BATH)], [unit, elsewhere], None, now=NOW)

    assert (found.kind, found.placement_id) == (AlertKind.EQUIPMENT_IN_DRY_ROOM, unit.placement_id)
    assert found.since == dried.readings[-1][0]


# ─── A whole job ──────────────────────────────────────────────────────────────


async def test_a_job_with_something_to_say(moisture_map: Map) -> None:
    kitchen, bath = await moisture_map.room("Kitchen"), await moisture_map.room("Bath")
    goal = {"dry_standard": "15", "dry_standard_basis": "reference"}
    dried = await moisture_map.point(kitchen, **goal)
    stuck = await moisture_map.point(bath, **goal)
    unmeasured = await moisture_map.point(bath)
    unit = await equipment.create_equipment(
        moisture_map.session,
        moisture_map.organization_id,
        EquipmentCreate.model_validate({"kind": "air_mover", "name": "Velo", "asset_tag": "AM-1"}),
        user=moisture_map.user,
    )
    running = await placements.place(
        moisture_map.session,
        moisture_map.organization_id,
        moisture_map.claim.id,
        PlacementCreate(
            equipment_id=unit.id,
            room_id=kitchen.id,
            placed_at=datetime.now(UTC) - timedelta(days=5),
        ),
        user=moisture_map.user,
    )
    visits = [
        {dried: "30", stuck: "30", unmeasured: "40"},
        {dried: "20", stuck: "30"},
        {dried: "14", stuck: "31"},
    ]
    for days_ago, readings in zip((4, 3, 2), visits, strict=True):
        await service.create_log(
            moisture_map.session,
            moisture_map.organization_id,
            moisture_map.claim.id,
            MoistureLogCreate.model_validate(
                {
                    "taken_at": (datetime.now(UTC) - timedelta(days=days_ago)).isoformat(),
                    "readings": [{"point_id": str(p.id), "value": v} for p, v in readings.items()],
                }
            ),
            user=moisture_map.user,
        )

    status = await service.drying_status(
        moisture_map.session,
        moisture_map.organization_id,
        moisture_map.claim.id,
        user=moisture_map.user,
    )

    summary = status.summary
    assert (summary.points, summary.dry, summary.drying, summary.no_goal) == (3, 1, 1, 1)
    assert summary.all_dry is False
    found = {a.kind: a for a in status.alerts}
    assert set(found) == {
        AlertKind.MONITORING_GAP,
        AlertKind.NO_GOAL,
        AlertKind.STALLED,
        AlertKind.EQUIPMENT_IN_DRY_ROOM,
    }
    stalled = found[AlertKind.STALLED].point
    assert stalled is not None
    assert stalled.label == stuck.label
    in_dry_room = found[AlertKind.EQUIPMENT_IN_DRY_ROOM]
    assert in_dry_room.equipment is not None
    assert (in_dry_room.equipment.asset_tag, in_dry_room.equipment.placement_id) == (
        "AM-1",
        running.id,
    )
    assert in_dry_room.room is not None
    assert in_dry_room.room.name == "Kitchen"
    assert found[AlertKind.MONITORING_GAP].details["hours"] >= 47


async def send(client: httpx2.AsyncClient, method: str, url: str, **body: Any) -> dict[str, Any]:
    response = await client.request(method, url, json=body or None)
    assert response.status_code < 300, response.text
    payload: dict[str, Any] = response.json() if response.content else {}
    return payload


async def test_over_http(auth_client: httpx2.AsyncClient, organization_id: UUID) -> None:
    base = f"/v1/organizations/{organization_id}"
    claim = await send(
        auth_client, "POST", f"{base}/claims", loss_type="water", property={"address": ADDRESS}
    )
    url = f"{base}/claims/{claim['id']}"

    empty = await send(auth_client, "GET", f"{url}/drying-status")
    assert empty["summary"] == {
        "points": 0,
        "dry": 0,
        "drying": 0,
        "no_goal": 0,
        "not_read": 0,
        "all_dry": False,
        "last_visit_at": None,
    }
    assert empty["alerts"] == []
