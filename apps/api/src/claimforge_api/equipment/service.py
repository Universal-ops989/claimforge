"""Keeping the organization's equipment inventory.

Reading needs ``org:read``; changes need ``field_data:write``: the technicians who load
the trucks are the ones who know what's on them.
"""

from uuid import UUID

from sqlalchemy import ColumnElement, Select, and_, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from claimforge_api.auth.permissions import Permission, authorize
from claimforge_api.core.errors import ConflictError, NotFoundError
from claimforge_api.db.pagination import Page, SortKey, paginate
from claimforge_api.db.search import icontains
from claimforge_api.equipment.models import Equipment, EquipmentPlacement, EquipmentStatus
from claimforge_api.equipment.schemas import EquipmentCreate, EquipmentQuery, EquipmentUpdate
from claimforge_api.users.models import User

BY_ASSET_TAG = SortKey([Equipment.asset_tag, Equipment.id])


class AssetTagTakenError(ConflictError):
    code = "asset_tag_taken"
    title = "Asset tag already used"


class EquipmentHasHistoryError(ConflictError):
    code = "equipment_has_history"
    title = "This unit has worked jobs"


def _inventory(organization_id: UUID) -> Select[Equipment]:
    return (
        select(Equipment)
        .where(Equipment.organization_id == organization_id)
        .options(selectinload(Equipment.current_placement).selectinload(EquipmentPlacement.claim))
    )


def _running() -> ColumnElement[bool]:
    return exists().where(
        EquipmentPlacement.equipment_id == Equipment.id, EquipmentPlacement.removed_at.is_(None)
    )


async def _get(session: AsyncSession, organization_id: UUID, equipment_id: UUID) -> Equipment:
    unit = await session.scalar(
        _inventory(organization_id)
        .where(Equipment.id == equipment_id)
        .execution_options(populate_existing=True)
    )
    if unit is None:
        raise NotFoundError("Equipment not found", equipment_id=str(equipment_id))
    return unit


async def _check_asset_tag(
    session: AsyncSession, organization_id: UUID, asset_tag: str, *, ignore: UUID | None = None
) -> None:
    statement = select(Equipment.id).where(
        Equipment.organization_id == organization_id,
        func.lower(Equipment.asset_tag) == asset_tag.lower(),
    )
    if ignore is not None:
        statement = statement.where(Equipment.id != ignore)
    if await session.scalar(statement) is not None:
        raise AssetTagTakenError(f"Asset tag {asset_tag} is already in use", asset_tag=asset_tag)


async def list_equipment(
    session: AsyncSession,
    organization_id: UUID,
    query: EquipmentQuery,
    *,
    user: User,
    limit: int,
    cursor: str | None,
) -> Page[Equipment]:
    """The inventory by asset tag."""
    await authorize(session, user, organization_id, Permission.ORG_READ)
    statement = _inventory(organization_id)
    if query.kind is not None:
        statement = statement.where(Equipment.kind == query.kind)
    if query.status is not None:
        statement = statement.where(Equipment.status == query.status)
    if query.available is not None:
        free = and_(Equipment.status == EquipmentStatus.IN_SERVICE, ~_running())
        statement = statement.where(free if query.available else ~free)
    if query.q and query.q.strip():
        statement = statement.where(
            or_(
                icontains(Equipment.asset_tag, query.q),
                icontains(Equipment.name, query.q),
                icontains(Equipment.serial_number, query.q),
            )
        )
    return await paginate(session, statement, BY_ASSET_TAG, limit=limit, cursor=cursor)


async def get_equipment(
    session: AsyncSession, organization_id: UUID, equipment_id: UUID, *, user: User
) -> Equipment:
    await authorize(session, user, organization_id, Permission.ORG_READ)
    return await _get(session, organization_id, equipment_id)


async def create_equipment(
    session: AsyncSession, organization_id: UUID, data: EquipmentCreate, *, user: User
) -> Equipment:
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    # A race between two identical tags ends at the unique index instead.
    await _check_asset_tag(session, organization_id, data.asset_tag)
    unit = Equipment(organization_id=organization_id, **data.model_dump())
    session.add(unit)
    await session.commit()
    return await _get(session, organization_id, unit.id)


async def update_equipment(
    session: AsyncSession,
    organization_id: UUID,
    equipment_id: UUID,
    data: EquipmentUpdate,
    *,
    user: User,
) -> Equipment:
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    unit = await _get(session, organization_id, equipment_id)
    changes = data.model_dump(exclude_unset=True)
    tag = changes.get("asset_tag")
    if tag is not None and tag.lower() != unit.asset_tag.lower():
        await _check_asset_tag(session, organization_id, tag, ignore=unit.id)
    for field, value in changes.items():
        setattr(unit, field, value)
    # Unchanged values leave no history, so a no-op writes neither a row nor an audit event.
    await session.commit()
    return await _get(session, organization_id, equipment_id)


async def delete_equipment(
    session: AsyncSession, organization_id: UUID, equipment_id: UUID, *, user: User
) -> None:
    """Remove a unit added by mistake. Units that worked jobs are retired instead."""
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    unit = await _get(session, organization_id, equipment_id)
    worked = await session.scalar(
        select(exists().where(EquipmentPlacement.equipment_id == unit.id))
    )
    if worked:
        raise EquipmentHasHistoryError(
            f"{unit.asset_tag} has been placed on jobs; set its status to retired instead"
        )
    await session.delete(unit)
    await session.commit()
