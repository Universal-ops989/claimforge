"""Laying out a claim's structures and rooms.

Reading needs ``claims:read``. Changes need ``field_data:write``, because technicians lay
out rooms on site, and are refused once the claim is closed or cancelled.
"""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from claimforge_api.auth.permissions import Permission, authorize
from claimforge_api.claims import service as claims
from claimforge_api.core.errors import BusinessRuleError, ConflictError, NotFoundError
from claimforge_api.structures.models import Room, Structure
from claimforge_api.structures.schemas import (
    RoomCreate,
    RoomUpdate,
    StructureCreate,
    StructureUpdate,
)
from claimforge_api.users.models import User


class NameTakenError(ConflictError):
    code = "name_taken"
    title = "Name already used"


class UnknownStructureError(BusinessRuleError):
    code = "unknown_structure"
    title = "Unknown structure"


async def _check_structure_name(
    session: AsyncSession, claim_id: UUID, name: str, *, ignore: UUID | None = None
) -> None:
    # The claim row is locked, so the name stays free until commit.
    statement = select(Structure.id).where(
        Structure.claim_id == claim_id, func.lower(Structure.name) == name.lower()
    )
    if ignore is not None:
        statement = statement.where(Structure.id != ignore)
    taken = await session.scalar(statement)
    if taken is not None:
        raise NameTakenError(
            f"This claim already has a structure named {name!r}", structure_id=str(taken)
        )


async def _check_room_name(
    session: AsyncSession, structure_id: UUID, name: str, *, ignore: UUID | None = None
) -> None:
    statement = select(Room.id).where(
        Room.structure_id == structure_id, func.lower(Room.name) == name.lower()
    )
    if ignore is not None:
        statement = statement.where(Room.id != ignore)
    taken = await session.scalar(statement)
    if taken is not None:
        raise NameTakenError(
            f"This structure already has a room named {name!r}", room_id=str(taken)
        )


async def _find_structure(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, structure_id: UUID
) -> Structure | None:
    return await session.scalar(
        select(Structure)
        .where(
            Structure.id == structure_id,
            Structure.claim_id == claim_id,
            Structure.organization_id == organization_id,
        )
        .options(selectinload(Structure.rooms))
        # Objects created earlier in this session have their relationships unloaded.
        .execution_options(populate_existing=True)
    )


async def _get_structure(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, structure_id: UUID
) -> Structure:
    structure = await _find_structure(session, organization_id, claim_id, structure_id)
    if structure is None:
        raise NotFoundError("Structure not found", structure_id=str(structure_id))
    return structure


async def _get_room(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, room_id: UUID
) -> Room:
    room = await session.scalar(
        select(Room)
        .where(
            Room.id == room_id,
            Room.claim_id == claim_id,
            Room.organization_id == organization_id,
        )
        .execution_options(populate_existing=True)
    )
    if room is None:
        raise NotFoundError("Room not found", room_id=str(room_id))
    return room


# ─── Structures ───────────────────────────────────────────────────────────────


async def list_structures(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, *, user: User
) -> list[Structure]:
    """A claim's structures with their rooms, in the order they were added."""
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    await claims.require_live(session, organization_id, claim_id)
    rows = await session.scalars(
        select(Structure)
        .where(Structure.claim_id == claim_id, Structure.organization_id == organization_id)
        .options(selectinload(Structure.rooms))
        .order_by(Structure.id)
        .execution_options(populate_existing=True)
    )
    return list(rows)


async def create_structure(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    data: StructureCreate,
    *,
    user: User,
) -> Structure:
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    await _check_structure_name(session, claim_id, data.name)
    structure = Structure(organization_id=organization_id, claim_id=claim_id, name=data.name)
    session.add(structure)
    await session.commit()
    return await _get_structure(session, organization_id, claim_id, structure.id)


async def update_structure(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    structure_id: UUID,
    data: StructureUpdate,
    *,
    user: User,
) -> Structure:
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    structure = await _get_structure(session, organization_id, claim_id, structure_id)
    if data.name is not None:
        await _check_structure_name(session, claim_id, data.name, ignore=structure.id)
        structure.name = data.name
    await session.commit()
    return await _get_structure(session, organization_id, claim_id, structure_id)


async def delete_structure(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, structure_id: UUID, *, user: User
) -> None:
    """Delete a structure and every room in it."""
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    # Rooms are loaded, so each one's removal is audited, not just the structure's.
    structure = await _get_structure(session, organization_id, claim_id, structure_id)
    await session.delete(structure)
    await session.commit()


# ─── Rooms ────────────────────────────────────────────────────────────────────


async def get_room(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, room_id: UUID, *, user: User
) -> Room:
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    await claims.require_live(session, organization_id, claim_id)
    return await _get_room(session, organization_id, claim_id, room_id)


async def create_room(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    structure_id: UUID,
    data: RoomCreate,
    *,
    user: User,
) -> Room:
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    structure = await _get_structure(session, organization_id, claim_id, structure_id)
    await _check_room_name(session, structure.id, data.name)
    room = Room(
        organization_id=organization_id,
        claim_id=claim_id,
        structure_id=structure.id,
        **data.model_dump(),
    )
    session.add(room)
    await session.commit()
    return await _get_room(session, organization_id, claim_id, room.id)


async def update_room(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    room_id: UUID,
    data: RoomUpdate,
    *,
    user: User,
) -> Room:
    """Rename, re-measure or move a room to another structure of the same claim."""
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    room = await _get_room(session, organization_id, claim_id, room_id)
    changes = data.model_dump(exclude_unset=True)

    target = changes.get("structure_id", room.structure_id)
    if target != room.structure_id and not await _find_structure(
        session, organization_id, claim_id, target
    ):
        raise UnknownStructureError("No such structure on this claim", structure_id=str(target))
    if "name" in changes or target != room.structure_id:
        await _check_room_name(session, target, changes.get("name", room.name), ignore=room.id)

    for field, value in changes.items():
        setattr(room, field, value)
    # Unchanged values leave no history, so a no-op writes neither a row nor an audit event.
    await session.commit()
    return await _get_room(session, organization_id, claim_id, room_id)


async def delete_room(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, room_id: UUID, *, user: User
) -> None:
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    room = await _get_room(session, organization_id, claim_id, room_id)
    await session.delete(room)
    await session.commit()
