"""Mapping moisture points on a claim.

Reading needs ``claims:read``; changes need ``field_data:write`` and a claim that is not
closed or cancelled. The claim row is locked for every change, so two technicians adding
points at once can't both take the next number.
"""

from collections.abc import Iterable
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, Select, SQLColumnExpression, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from claimforge_api.auth.permissions import Permission, authorize
from claimforge_api.claims import service as claims
from claimforge_api.core.errors import BusinessRuleError, ConflictError, NotFoundError
from claimforge_api.moisture.models import MoisturePoint
from claimforge_api.moisture.schemas import (
    MoisturePointCreate,
    MoisturePointQuery,
    MoisturePointUpdate,
)
from claimforge_api.structures.models import Room
from claimforge_api.users.models import User


class UnknownRoomError(BusinessRuleError):
    code = "unknown_room"
    title = "Unknown room"


class LabelTakenError(ConflictError):
    code = "label_taken"
    title = "Label already used"


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
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    point = await _get_point(session, organization_id, claim_id, point_id)
    await session.delete(point)
    await session.commit()
