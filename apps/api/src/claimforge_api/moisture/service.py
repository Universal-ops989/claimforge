"""Mapping moisture points on a claim.

Reading needs ``claims:read``; changes need ``field_data:write`` and a claim that is not
closed or cancelled. The claim row is locked for every change, so two technicians adding
points at once can't both take the next number.
"""

from collections.abc import Iterable
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, Select, SQLColumnExpression, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from claimforge_api.auth.permissions import Permission, authorize
from claimforge_api.claims import service as claims
from claimforge_api.claims.schemas import ClaimActor
from claimforge_api.core.errors import BusinessRuleError, ConflictError, NotFoundError
from claimforge_api.db.pagination import Page, SortKey, paginate
from claimforge_api.moisture.models import MoistureLog, MoisturePoint, MoistureReading
from claimforge_api.moisture.schemas import (
    DryingLog,
    DryingLogPoint,
    DryingLogQuery,
    DryingLogRoom,
    DryingLogVisit,
    MoistureLogCreate,
    MoistureLogRead,
    MoistureLogUpdate,
    MoisturePointCreate,
    MoisturePointQuery,
    MoisturePointUpdate,
    ReadingRead,
)
from claimforge_api.structures.models import Room
from claimforge_api.users.models import User


class UnknownRoomError(BusinessRuleError):
    code = "unknown_room"
    title = "Unknown room"


class LabelTakenError(ConflictError):
    code = "label_taken"
    title = "Label already used"


class UnknownPointError(BusinessRuleError):
    code = "unknown_moisture_point"
    title = "Unknown moisture point"


class TakenInFutureError(BusinessRuleError):
    code = "taken_in_future"
    title = "Readings can't be from the future"


class NoReadingsError(BusinessRuleError):
    code = "no_readings"
    title = "A visit needs at least one reading"


#: Leeway for "now" between devices whose clocks disagree a little.
CLOCK_SKEW = timedelta(minutes=10)
LOGS_NEWEST_FIRST = SortKey([MoistureLog.taken_at, MoistureLog.id], direction="desc")


def label_key(label: str) -> tuple[bool, str]:
    """:func:`natural_order`, in Python."""
    return (not label.isdigit(), label.lower().rjust(20, "0"))


def natural_order(label: SQLColumnExpression[str]) -> tuple[ColumnElement[Any], ...]:
    """Sort keys putting "2" before "10", and numbers before "A", as people number the map."""
    return (label.regexp_match("^[0-9]+$").is_(False), func.lpad(func.lower(label), 20, "0"))


def next_label(labels: Iterable[str]) -> str:
    """One more than the highest numbered label: gaps left by deleted points stay gaps."""
    numbers = [int(label) for label in labels if label.isdigit()]
    return str(max(numbers, default=0) + 1)


def _points(organization_id: UUID, claim_id: UUID) -> Select[MoisturePoint]:
    return (
        select(MoisturePoint)
        .where(MoisturePoint.claim_id == claim_id, MoisturePoint.organization_id == organization_id)
        .options(selectinload(MoisturePoint.room))
        .execution_options(populate_existing=True)
    )


async def _get_point(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, point_id: UUID
) -> MoisturePoint:
    point = await session.scalar(
        _points(organization_id, claim_id).where(MoisturePoint.id == point_id)
    )
    if point is None:
        raise NotFoundError("Moisture point not found", moisture_point_id=str(point_id))
    return point


async def _check_room(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, room_id: UUID
) -> None:
    found = await session.scalar(
        select(Room.id).where(
            Room.id == room_id, Room.claim_id == claim_id, Room.organization_id == organization_id
        )
    )
    if found is None:
        raise UnknownRoomError("No such room on this claim", room_id=str(room_id))


async def _labels(session: AsyncSession, claim_id: UUID) -> list[str]:
    return list(
        await session.scalars(select(MoisturePoint.label).where(MoisturePoint.claim_id == claim_id))
    )


async def _check_label(
    session: AsyncSession, claim_id: UUID, label: str, *, ignore: UUID | None = None
) -> None:
    # The claim row is locked, so the label stays free until commit.
    statement = select(MoisturePoint.id).where(
        MoisturePoint.claim_id == claim_id, func.lower(MoisturePoint.label) == label.lower()
    )
    if ignore is not None:
        statement = statement.where(MoisturePoint.id != ignore)
    if await session.scalar(statement) is not None:
        raise LabelTakenError(f"Point {label} is already on this claim's map", label=label)


async def points_in_rooms(session: AsyncSession, room_ids: Iterable[UUID]) -> int:
    """How many moisture points the rooms hold (rooms that hold any can't be deleted)."""
    ids = list(room_ids)
    if not ids:
        return 0
    count = await session.scalar(
        select(func.count()).select_from(MoisturePoint).where(MoisturePoint.room_id.in_(ids))
    )
    return int(count or 0)


async def list_points(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    query: MoisturePointQuery | None = None,
    *,
    user: User,
) -> list[MoisturePoint]:
    """A claim's points, room by room (in the order rooms were added), by label."""
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    await claims.require_live(session, organization_id, claim_id)
    statement = _points(organization_id, claim_id).order_by(
        MoisturePoint.room_id, *natural_order(MoisturePoint.label)
    )
    if query is not None and query.room_id is not None:
        statement = statement.where(MoisturePoint.room_id == query.room_id)
    return list(await session.scalars(statement))


async def get_point(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, point_id: UUID, *, user: User
) -> MoisturePoint:
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    await claims.require_live(session, organization_id, claim_id)
    return await _get_point(session, organization_id, claim_id, point_id)


async def create_point(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    data: MoisturePointCreate,
    *,
    user: User,
) -> MoisturePoint:
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    await _check_room(session, organization_id, claim_id, data.room_id)
    label = data.label or next_label(await _labels(session, claim_id))
    await _check_label(session, claim_id, label)
    point = MoisturePoint(
        organization_id=organization_id,
        claim_id=claim_id,
        **data.model_dump(exclude={"label"}),
        label=label,
    )
    session.add(point)
    await session.commit()
    return await _get_point(session, organization_id, claim_id, point.id)


async def update_point(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    point_id: UUID,
    data: MoisturePointUpdate,
    *,
    user: User,
) -> MoisturePoint:
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    point = await _get_point(session, organization_id, claim_id, point_id)
    changes = data.model_dump(exclude_unset=True)
    if changes.get("room_id", point.room_id) != point.room_id:
        await _check_room(session, organization_id, claim_id, changes["room_id"])
    if "label" in changes and changes["label"].lower() != point.label.lower():
        await _check_label(session, claim_id, changes["label"], ignore=point.id)
    for field, value in changes.items():
        setattr(point, field, value)
    # Unchanged values leave no history, so a no-op writes neither a row nor an audit event.
    await session.commit()
    return await _get_point(session, organization_id, claim_id, point_id)


async def delete_point(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, point_id: UUID, *, user: User
) -> None:
    """Delete a point and its readings (each one's removal is audited)."""
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    point = await session.scalar(
        _points(organization_id, claim_id)
        .where(MoisturePoint.id == point_id)
        .options(selectinload(MoisturePoint.readings))
    )
    if point is None:
        raise NotFoundError("Moisture point not found", moisture_point_id=str(point_id))
    await session.delete(point)
    await session.commit()


# ─── Monitoring visits ────────────────────────────────────────────────────────


def _logs(organization_id: UUID, claim_id: UUID) -> Select[MoistureLog]:
    return (
        select(MoistureLog)
        .where(MoistureLog.claim_id == claim_id, MoistureLog.organization_id == organization_id)
        .options(
            selectinload(MoistureLog.taken_by),
            selectinload(MoistureLog.readings).selectinload(MoistureReading.point),
        )
        .execution_options(populate_existing=True)
    )


async def _get_log(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, log_id: UUID
) -> MoistureLog:
    log = await session.scalar(_logs(organization_id, claim_id).where(MoistureLog.id == log_id))
    if log is None:
        raise NotFoundError("Moisture log not found", moisture_log_id=str(log_id))
    return log


def _actor(user: User | None) -> ClaimActor | None:
    return ClaimActor.model_validate(user) if user else None


def present_log(log: MoistureLog) -> MoistureLogRead:
    readings = sorted(log.readings, key=lambda r: label_key(r.point.label))
    return MoistureLogRead(
        id=log.id,
        taken_at=log.taken_at,
        taken_by=_actor(log.taken_by),
        notes=log.notes,
        readings=[
            ReadingRead(point_id=r.point_id, label=r.point.label, value=r.value) for r in readings
        ],
        readings_edited_at=log.readings_edited_at,
        created_at=log.created_at,
        updated_at=log.updated_at,
    )


def _check_taken_at(taken_at: datetime) -> None:
    if taken_at > datetime.now(UTC) + CLOCK_SKEW:
        raise TakenInFutureError(
            "Readings can be entered late, but not ahead of time", taken_at=taken_at.isoformat()
        )


async def _check_points(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, point_ids: set[UUID]
) -> None:
    if not point_ids:
        return
    found = set(
        await session.scalars(
            select(MoisturePoint.id).where(
                MoisturePoint.id.in_(point_ids),
                MoisturePoint.claim_id == claim_id,
                MoisturePoint.organization_id == organization_id,
            )
        )
    )
    unknown = point_ids - found
    if unknown:
        raise UnknownPointError(
            "Not moisture points of this claim", point_ids=sorted(str(p) for p in unknown)
        )


async def list_logs(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    *,
    user: User,
    limit: int,
    cursor: str | None,
) -> Page[MoistureLog]:
    """A claim's monitoring visits, most recent first."""
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    await claims.require_live(session, organization_id, claim_id)
    statement = _logs(organization_id, claim_id)
    return await paginate(session, statement, LOGS_NEWEST_FIRST, limit=limit, cursor=cursor)


async def get_log(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, log_id: UUID, *, user: User
) -> MoistureLog:
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    await claims.require_live(session, organization_id, claim_id)
    return await _get_log(session, organization_id, claim_id, log_id)


def _reading(organization_id: UUID, claim_id: UUID, point_id: UUID, value: Any) -> MoistureReading:
    return MoistureReading(
        organization_id=organization_id, claim_id=claim_id, point_id=point_id, value=value
    )


async def create_log(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    data: MoistureLogCreate,
    *,
    user: User,
) -> MoistureLog:
    """Record a visit and its readings."""
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    taken_at = data.taken_at or datetime.now(UTC)
    _check_taken_at(taken_at)
    await _check_points(session, organization_id, claim_id, {r.point_id for r in data.readings})
    log = MoistureLog(
        organization_id=organization_id,
        claim_id=claim_id,
        taken_at=taken_at,
        taken_by_id=user.id,
        notes=data.notes,
        readings=[_reading(organization_id, claim_id, r.point_id, r.value) for r in data.readings],
    )
    session.add(log)
    await session.commit()
    return await _get_log(session, organization_id, claim_id, log.id)


async def update_log(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    log_id: UUID,
    data: MoistureLogUpdate,
    *,
    user: User,
) -> MoistureLog:
    """Correct a visit: its time, notes, or readings (set, add, or remove with null)."""
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    log = await _get_log(session, organization_id, claim_id, log_id)
    changes = data.model_dump(exclude_unset=True, exclude={"readings"})
    if "taken_at" in changes:
        _check_taken_at(changes["taken_at"])
    added = {r.point_id for r in data.readings if r.value is not None}
    await _check_points(session, organization_id, claim_id, added)

    current = {reading.point_id: reading for reading in log.readings}
    corrected = False
    for change in data.readings:
        reading = current.get(change.point_id)
        if change.value is None:
            if reading is not None:
                log.readings.remove(reading)  # delete-orphan: audited as deleted
                corrected = True
        elif reading is None:
            log.readings.append(_reading(organization_id, claim_id, change.point_id, change.value))
            corrected = True
        elif reading.value != change.value:
            reading.value = change.value
            corrected = True
    if not log.readings:
        raise NoReadingsError("Delete the visit instead of removing every reading")
    for field, value in changes.items():
        setattr(log, field, value)
    if corrected:
        log.readings_edited_at = datetime.now(UTC)
    # Unchanged values leave no history, so a no-op writes neither a row nor an audit event.
    await session.commit()
    return await _get_log(session, organization_id, claim_id, log_id)


async def delete_log(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, log_id: UUID, *, user: User
) -> None:
    """Delete a visit and its readings (each one's removal is audited)."""
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    log = await _get_log(session, organization_id, claim_id, log_id)
    await session.delete(log)
    await session.commit()


async def drying_log(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    query: DryingLogQuery | None = None,
    *,
    user: User,
) -> DryingLog:
    """The monitoring table: each point's readings, visit by visit, oldest visit first.

    Visits that read none of the points shown are left out, so a room's table has no
    empty columns.
    """
    points = await list_points(
        session,
        organization_id,
        claim_id,
        MoisturePointQuery(room_id=query.room_id if query else None),
        user=user,
    )
    values: dict[tuple[UUID, UUID], Any] = {}
    if points:
        rows = await session.execute(
            select(MoistureReading.log_id, MoistureReading.point_id, MoistureReading.value).where(
                MoistureReading.claim_id == claim_id,
                MoistureReading.point_id.in_([point.id for point in points]),
            )
        )
        values = {(log_id, point_id): value for log_id, point_id, value in rows}
    logs = list(
        await session.scalars(
            select(MoistureLog)
            .where(MoistureLog.claim_id == claim_id, MoistureLog.id.in_({k[0] for k in values}))
            .options(selectinload(MoistureLog.taken_by))
            .order_by(MoistureLog.taken_at, MoistureLog.id)
        )
    )

    rooms: dict[UUID, DryingLogRoom] = {}
    for point in points:
        room = rooms.setdefault(
            point.room_id, DryingLogRoom(id=point.room.id, name=point.room.name, points=[])
        )
        room.points.append(
            DryingLogPoint(
                id=point.id,
                label=point.label,
                material=point.material,
                surface=point.surface,
                scale=point.scale,
                values=[values.get((log.id, point.id)) for log in logs],
            )
        )
    return DryingLog(
        visits=[
            DryingLogVisit(id=log.id, taken_at=log.taken_at, taken_by=_actor(log.taken_by))
            for log in logs
        ],
        rooms=list(rooms.values()),
    )
