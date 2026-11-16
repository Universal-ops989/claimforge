"""Drying goals: setting a point's dry standard, and knowing when it's reached."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

import httpx2
import pytest
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from tests.moisture.conftest import ADDRESS, Map

from claimforge_api.moisture import goals, service
from claimforge_api.moisture.goals import DryingStatus
from claimforge_api.moisture.models import MoisturePoint
from claimforge_api.moisture.schemas import (
    DryingLogQuery,
    MoistureLogCreate,
    MoisturePointCreate,
    MoisturePointUpdate,
)

D = Decimal
START = datetime(2026, 11, 10, 9, tzinfo=UTC)


def days(*values: str) -> list[tuple[datetime, Decimal]]:
    """Readings a day apart, from START."""
    return [(START + timedelta(days=n), D(v)) for n, v in enumerate(values)]


@pytest.mark.parametrize(
    ("readings", "goal", "status", "latest", "dried_on_day"),
    [
        ([], "15", DryingStatus.NOT_READ, None, None),
        (days("30"), None, DryingStatus.NO_GOAL, "30", None),
        (days("30", "20"), "15", DryingStatus.DRYING, "20", None),
        (days("30", "20", "14", "13"), "15", DryingStatus.DRY, "13", 2),
        (days("30", "15"), "15", DryingStatus.DRY, "15", 1),  # at the goal is dry
        # Dipped, came back up, dipped again: dry since the second dip.
        (days("30", "14", "17", "14"), "15", DryingStatus.DRY, "14", 3),
    ],
)
def test_progress(
    readings: list[tuple[datetime, Decimal]],
    goal: str | None,
    status: DryingStatus,
    latest: str | None,
    dried_on_day: int | None,
) -> None:
    state = goals.progress(readings, D(goal) if goal else None)

    assert state.status == status
    assert state.latest == (D(latest) if latest else None)
    expected = START + timedelta(days=dried_on_day) if dried_on_day is not None else None
    assert state.dried_at == expected


def test_a_goal_comes_with_its_basis() -> None:
    point = {"room_id": "0192f3a4-5b6c-7d8e-9f01-000000000001", "material": "Drywall"}
    point |= {"surface": "wall", "scale": "percent"}
    assert MoisturePointCreate.model_validate(
        point | {"dry_standard": "12", "dry_standard_basis": "reference"}
    ).dry_standard == D("12")
    for fields in ({"dry_standard": "12"}, {"dry_standard_basis": "reference"}):
        with pytest.raises(ValidationError, match="basis"):
            MoisturePointCreate.model_validate(point | fields)
    with pytest.raises(ValidationError, match="together"):
        MoisturePointUpdate.model_validate({"dry_standard": None})
    cleared = MoisturePointUpdate.model_validate({"dry_standard": None, "dry_standard_basis": None})
    assert cleared.model_fields_set == {"dry_standard", "dry_standard_basis"}


async def test_the_database_wants_a_basis_too(moisture_map: Map) -> None:
    point = await moisture_map.point(await moisture_map.room("Kitchen"))
    stored = await moisture_map.session.get(MoisturePoint, point.id)
    assert stored is not None
    stored.dry_standard = D("12")
    with pytest.raises(IntegrityError, match="dry_standard_has_basis"):
        await moisture_map.session.flush()
    await moisture_map.session.rollback()


async def test_status_in_the_drying_log(moisture_map: Map) -> None:
    kitchen = await moisture_map.room("Kitchen")
    goal = {"dry_standard": "15", "dry_standard_basis": "reference"}
    dried = await moisture_map.point(kitchen, **goal)
    wet = await moisture_map.point(kitchen, dry_standard="12", dry_standard_basis="published")
    unmeasured = await moisture_map.point(kitchen)
    unread = await moisture_map.point(kitchen, **goal)

    taken = [datetime.now(UTC) - timedelta(days=3 - n) for n in range(3)]
    values = [
        {dried: "30", wet: "25", unmeasured: "40"},
        {dried: "20", wet: "18"},
        {dried: "14"},
    ]
    for at, readings in zip(taken, values, strict=True):
        await service.create_log(
            moisture_map.session,
            moisture_map.organization_id,
            moisture_map.claim.id,
            MoistureLogCreate.model_validate(
                {
                    "taken_at": at.isoformat(),
                    "readings": [{"point_id": str(p.id), "value": v} for p, v in readings.items()],
                }
            ),
            user=moisture_map.user,
        )

    log = await service.drying_log(
        moisture_map.session,
        moisture_map.organization_id,
        moisture_map.claim.id,
        DryingLogQuery(),
        user=moisture_map.user,
    )
    rows = {p.id: p for p in log.rooms[0].points}
    assert (rows[dried.id].status, rows[dried.id].dried_at) == ("dry", taken[2])
    assert (rows[wet.id].status, rows[wet.id].dried_at) == ("drying", None)
    assert rows[unmeasured.id].status == "no_goal"
    assert rows[unread.id].status == "not_read"
    assert (rows[wet.id].dry_standard, rows[wet.id].dry_standard_basis) == (D("12"), "published")


async def send(client: httpx2.AsyncClient, method: str, url: str, **body: Any) -> dict[str, Any]:
    response = await client.request(method, url, json=body or None)
    assert response.status_code < 300, response.text
    payload: dict[str, Any] = response.json() if response.content else {}
    return payload


async def test_setting_goals_over_http(
    auth_client: httpx2.AsyncClient, organization_id: UUID
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
        material="Subfloor",
        surface="floor",
        scale="percent",
    )
    edit = f"{url}/moisture-points/{point['id']}"

    goal = await send(auth_client, "PATCH", edit, dry_standard=15, dry_standard_basis="reference")
    assert (goal["dry_standard"], goal["dry_standard_basis"]) == (15.0, "reference")
    half = await auth_client.patch(edit, json={"dry_standard_basis": "manual"})
    assert half.status_code == 422
    await send(auth_client, "PATCH", edit, dry_standard=None, dry_standard_basis=None)

    timeline = (await auth_client.get(f"{url}/timeline", params={"kind": "moisture"})).json()
    assert [entry["summary"] for entry in timeline["items"]][:2] == [
        "Cleared the dry standard of moisture point 1",
        "Set the dry standard of moisture point 1 to 15 (reference)",
    ]
