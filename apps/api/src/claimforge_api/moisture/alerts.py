"""What on a drying job needs attention, worked out from its records.

Pure functions over plain data, so each rule is easy to read and test. The service gathers
the claim's points, readings, visits and running equipment, and calls :func:`alerts`.
"""

from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal
from enum import StrEnum
from itertools import pairwise
from uuid import UUID

from claimforge_api.moisture.goals import DryingStatus, Progress, progress

#: A drying point whose last this-many readings never improved has stalled.
STALL_READINGS = 3
#: IICRC S500 expects drying to be monitored at least daily.
MONITORING_INTERVAL = timedelta(hours=24)


class AlertKind(StrEnum):
    NO_GOAL = "no_goal"
    STALLED = "stalled"
    MONITORING_GAP = "monitoring_gap"
    EQUIPMENT_IN_DRY_ROOM = "equipment_in_dry_room"


@dataclass(frozen=True)
class Point:
    id: UUID
    label: str
    room_id: UUID
    goal: Decimal | None
    #: Oldest first.
    readings: Sequence[tuple[datetime, Decimal]]

    @property
    def progress(self) -> Progress:
        return progress(self.readings, self.goal)


@dataclass(frozen=True)
class Running:
    placement_id: UUID
    asset_tag: str
    room_id: UUID
    placed_at: datetime


@dataclass(frozen=True)
class Alert:
    kind: AlertKind
    message: str
    point_id: UUID | None = None
    room_id: UUID | None = None
    placement_id: UUID | None = None
    #: Since when the condition holds, where that's known.
    since: datetime | None = None
    extra: dict[str, object] = field(default_factory=dict)


def stalled(point: Point) -> bool:
    """Still drying, and none of the last readings went below the one before them."""
    if point.progress.status != DryingStatus.DRYING or len(point.readings) < STALL_READINGS:
        return False
    recent = [value for _, value in point.readings[-STALL_READINGS:]]
    return all(later >= earlier for earlier, later in pairwise(recent))


def dry_rooms(points: Sequence[Point]) -> dict[UUID, datetime]:
    """Rooms whose every point has a goal and has reached it, with when the last one did."""
    by_room: dict[UUID, list[Point]] = {}
    for point in points:
        by_room.setdefault(point.room_id, []).append(point)
    dry: dict[UUID, datetime] = {}
    for room_id, room_points in by_room.items():
        states = [p.progress for p in room_points]
        if all(s.status == DryingStatus.DRY and s.dried_at for s in states):
            dry[room_id] = max(s.dried_at for s in states if s.dried_at is not None)
    return dry


def alerts(
    points: Sequence[Point],
    running: Sequence[Running],
    last_visit: datetime | None,
    *,
    now: datetime,
) -> list[Alert]:
    found: list[Alert] = []
    drying = [p for p in points if p.progress.status == DryingStatus.DRYING]

    if drying and last_visit is not None and now - last_visit > MONITORING_INTERVAL:
        hours = int((now - last_visit).total_seconds() // 3600)
        found.append(
            Alert(
                AlertKind.MONITORING_GAP,
                f"{len(drying)} point(s) still drying, last read {hours} hours ago",
                since=last_visit,
                extra={"hours": hours, "drying_points": len(drying)},
            )
        )
    for point in points:
        if point.progress.status == DryingStatus.NO_GOAL:
            found.append(
                Alert(
                    AlertKind.NO_GOAL,
                    f"Point {point.label} is being read but has no dry standard",
                    point_id=point.id,
                    room_id=point.room_id,
                )
            )
        elif stalled(point):
            since = point.readings[-STALL_READINGS][0]
            found.append(
                Alert(
                    AlertKind.STALLED,
                    f"Point {point.label} hasn't improved over its last {STALL_READINGS} readings",
                    point_id=point.id,
                    room_id=point.room_id,
                    since=since,
                )
            )
    dry = dry_rooms(points)
    for unit in running:
        if unit.room_id in dry:
            since = max(dry[unit.room_id], unit.placed_at)
            found.append(
                Alert(
                    AlertKind.EQUIPMENT_IN_DRY_ROOM,
                    f"{unit.asset_tag} is still running in a room that's dry",
                    room_id=unit.room_id,
                    placement_id=unit.placement_id,
                    since=since,
                )
            )
    return found
