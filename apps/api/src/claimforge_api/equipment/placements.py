"""Placing equipment in a claim's rooms, pulling it out, and counting equipment-days.

Reading needs ``claims:read``; changes need ``field_data:write``. Placing and correcting
need an open claim, but pulling a unit doesn't: a unit left running when a claim closed
must still be able to come home. The unit's row is locked while it's placed or put back
to running, so two technicians can't place the same unit at once.
"""

from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from claimforge_api.auth.permissions import Permission, authorize
from claimforge_api.claims import service as claims
from claimforge_api.claims.models import Claim
from claimforge_api.core.errors import BusinessRuleError, ConflictError, NotFoundError
from claimforge_api.equipment.models import (
    Equipment,
    EquipmentKind,
    EquipmentPlacement,
    EquipmentStatus,
    equipment_days,
)
from claimforge_api.equipment.schemas import (
    EquipmentDays,
    PlacementCreate,
    PlacementQuery,
    PlacementRemove,
    PlacementUpdate,
)
from claimforge_api.structures.models import Room
from claimforge_api.users.models import User

#: Leeway for "now" between devices whose clocks disagree a little.
CLOCK_SKEW = timedelta(minutes=10)


class UnknownRoomError(BusinessRuleError):
    code = "unknown_room"
    title = "Unknown room"


class EquipmentUnavailableError(ConflictError):
    code = "equipment_unavailable"
    title = "This unit is in maintenance or retired"


class EquipmentRunningError(ConflictError):
    code = "equipment_running"
    title = "This unit is already running somewhere"


class AlreadyRemovedError(ConflictError):
    code = "already_removed"
    title = "This unit was already removed"


class TimeInFutureError(BusinessRuleError):
    code = "time_in_future"
    title = "Times can't be in the future"


class RemovedBeforePlacedError(BusinessRuleError):
    code = "removed_before_placed"
    title = "A unit can't be removed before it was placed"


def _placements(organization_id: UUID, claim_id: UUID) -> Select[EquipmentPlacement]:
    return (
        select(EquipmentPlacement)
        .where(
            EquipmentPlacement.claim_id == claim_id,
            EquipmentPlacement.organization_id == organization_id,
        )
        .options(
            selectinload(EquipmentPlacement.equipment),
            selectinload(EquipmentPlacement.room),
            selectinload(EquipmentPlacement.placed_by),
            selectinload(EquipmentPlacement.removed_by),
        )
        .execution_options(populate_existing=True)
    )


async def _get(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    placement_id: UUID,
    *,
    lock: bool = False,
) -> EquipmentPlacement:
    statement = _placements(organization_id, claim_id).where(EquipmentPlacement.id == placement_id)
    if lock:
        statement = statement.with_for_update(of=EquipmentPlacement)
    placement = await session.scalar(statement)
    if placement is None:
        raise NotFoundError("Placement not found", placement_id=str(placement_id))
    return placement


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


async def _lock_unit(session: AsyncSession, organization_id: UUID, equipment_id: UUID) -> Equipment:
    unit = await session.scalar(
        select(Equipment)
        .where(Equipment.id == equipment_id, Equipment.organization_id == organization_id)
        .with_for_update()
    )
    if unit is None:
        raise NotFoundError("Equipment not found", equipment_id=str(equipment_id))
    return unit


async def _check_free(
    session: AsyncSession, unit: Equipment, *, ignore: UUID | None = None
) -> None:
    statement = (
        select(EquipmentPlacement.claim_id, Claim.number)
        .join(Claim, Claim.id == EquipmentPlacement.claim_id)
        .where(EquipmentPlacement.equipment_id == unit.id, EquipmentPlacement.removed_at.is_(None))
    )
    if ignore is not None:
        statement = statement.where(EquipmentPlacement.id != ignore)
    running = (await session.execute(statement)).first()
    if running is not None:
        raise EquipmentRunningError(
            f"{unit.asset_tag} is running on claim {running.number}; remove it there first",
            claim_id=str(running.claim_id),
            claim_number=running.number,
        )


def _check_times(placed_at: datetime, removed_at: datetime | None) -> None:
    latest = datetime.now(UTC) + CLOCK_SKEW
    for moment in (placed_at, removed_at):
        if moment is not None and moment > latest:
            raise TimeInFutureError("Record times as they happen, or later", at=moment.isoformat())
    if removed_at is not None and removed_at < placed_at:
        raise RemovedBeforePlacedError(
            "Removed before it was placed",
            placed_at=placed_at.isoformat(),
            removed_at=removed_at.isoformat(),
        )


async def list_placements(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    query: PlacementQuery | None = None,
    *,
    user: User,
) -> list[EquipmentPlacement]:
    """A claim's placements in the order units were placed."""
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    await claims.require_live(session, organization_id, claim_id)
    statement = _placements(organization_id, claim_id).order_by(
        EquipmentPlacement.placed_at, EquipmentPlacement.id
    )
    if query is not None:
        if query.running is not None:
            running = EquipmentPlacement.removed_at.is_(None)
            statement = statement.where(running if query.running else ~running)
        if query.room_id is not None:
            statement = statement.where(EquipmentPlacement.room_id == query.room_id)
    return list(await session.scalars(statement))


async def equipment_days_by_kind(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, *, user: User
) -> list[EquipmentDays]:
    """Placements, running units and billable days per kind, in the kinds' order."""
    placements = await list_placements(session, organization_id, claim_id, user=user)
    now = datetime.now(UTC)
    totals: dict[EquipmentKind, EquipmentDays] = {}
    for placement in placements:
        kind = EquipmentKind(placement.kind)
        total = totals.setdefault(kind, EquipmentDays(kind=kind, placements=0, running=0, days=0))
        total.placements += 1
        total.running += placement.running
        total.days += equipment_days(placement.placed_at, placement.removed_at or now)
    return [totals[kind] for kind in EquipmentKind if kind in totals]


async def place(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    data: PlacementCreate,
    *,
    user: User,
) -> EquipmentPlacement:
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    await _check_room(session, organization_id, claim_id, data.room_id)
    unit = await _lock_unit(session, organization_id, data.equipment_id)
    if unit.status != EquipmentStatus.IN_SERVICE:
        raise EquipmentUnavailableError(
            f"{unit.asset_tag} is {unit.status.replace('_', ' ')}",
            equipment_status=str(unit.status),
        )
    await _check_free(session, unit)
    placed_at = data.placed_at or datetime.now(UTC)
    _check_times(placed_at, None)
    placement = EquipmentPlacement(
        organization_id=organization_id,
        claim_id=claim_id,
        room_id=data.room_id,
        equipment_id=unit.id,
        kind=unit.kind,
        asset_tag=unit.asset_tag,
        placed_at=placed_at,
        placed_by_id=user.id,
    )
    session.add(placement)
    await session.commit()
    return await _get(session, organization_id, claim_id, placement.id)


async def remove(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    placement_id: UUID,
    data: PlacementRemove,
    *,
    user: User,
) -> EquipmentPlacement:
    """Pull a unit. Works on closed claims too, so no unit is stranded on a finished job."""
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.require_live(session, organization_id, claim_id)
    placement = await _get(session, organization_id, claim_id, placement_id, lock=True)
    if placement.removed_at is not None:
        raise AlreadyRemovedError(removed_at=placement.removed_at.isoformat())
    removed_at = data.removed_at or datetime.now(UTC)
    _check_times(placement.placed_at, removed_at)
    placement.removed_at = removed_at
    placement.removed_by_id = user.id
    await session.commit()
    return await _get(session, organization_id, claim_id, placement_id)


async def update_placement(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    placement_id: UUID,
    data: PlacementUpdate,
    *,
    user: User,
) -> EquipmentPlacement:
    """Correct a placement's room or times."""
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    placement = await _get(session, organization_id, claim_id, placement_id, lock=True)
    changes = data.model_dump(exclude_unset=True)
    if changes.get("room_id", placement.room_id) != placement.room_id:
        await _check_room(session, organization_id, claim_id, changes["room_id"])
    reopening = "removed_at" in changes and changes["removed_at"] is None
    if reopening and placement.removed_at is not None:
        unit = await _lock_unit(session, organization_id, placement.equipment_id)
        await _check_free(session, unit, ignore=placement.id)
        changes["removed_by_id"] = None
    _check_times(
        changes.get("placed_at", placement.placed_at),
        changes.get("removed_at", placement.removed_at),
    )
    for field, value in changes.items():
        setattr(placement, field, value)
    # Unchanged values leave no history, so a no-op writes neither a row nor an audit event.
    await session.commit()
    return await _get(session, organization_id, claim_id, placement_id)


async def delete_placement(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    placement_id: UUID,
    *,
    user: User,
) -> None:
    """Remove a placement entered by mistake (it disappears from billing)."""
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    placement = await _get(session, organization_id, claim_id, placement_id)
    await session.delete(placement)
    await session.commit()


async def placements_in_rooms(session: AsyncSession, room_ids: list[UUID]) -> int:
    """How many placements the rooms hold (rooms that hold any can't be deleted)."""
    if not room_ids:
        return 0
    count = await session.scalar(
        select(func.count())
        .select_from(EquipmentPlacement)
        .where(EquipmentPlacement.room_id.in_(room_ids))
    )
    return int(count or 0)
