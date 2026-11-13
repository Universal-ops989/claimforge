"""HTTP endpoints for a claim's structures and rooms."""

from uuid import UUID

from fastapi import APIRouter, status

from claimforge_api.api.deps import DbSession
from claimforge_api.api.problems import PROBLEM_RESPONSES
from claimforge_api.auth.deps import CurrentUser
from claimforge_api.structures import service
from claimforge_api.structures.schemas import (
    RoomCreate,
    RoomRead,
    RoomUpdate,
    StructureCreate,
    StructureRead,
    StructureUpdate,
)

router = APIRouter(
    prefix="/organizations/{organization_id}/claims/{claim_id}",
    tags=["structures"],
    responses=PROBLEM_RESPONSES,
)

_CHANGES = "Needs `field_data:write`. Closed and cancelled claims are read-only (`claim_locked`)."


@router.get(
    "/structures",
    summary="List a claim's structures and rooms",
    description="Structures and the rooms in each, in the order they were added.",
)
async def list_structures(
    organization_id: UUID, claim_id: UUID, session: DbSession, user: CurrentUser
) -> list[StructureRead]:
    structures = await service.list_structures(session, organization_id, claim_id, user=user)
    return [StructureRead.model_validate(s) for s in structures]


@router.post(
    "/structures",
    status_code=status.HTTP_201_CREATED,
    summary="Add a structure",
    description=f"Names are unique per claim, ignoring case. {_CHANGES}",
)
async def create_structure(
    organization_id: UUID,
    claim_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: StructureCreate,
) -> StructureRead:
    structure = await service.create_structure(session, organization_id, claim_id, body, user=user)
    return StructureRead.model_validate(structure)


@router.patch(
    "/structures/{structure_id}",
    summary="Rename a structure",
    description=_CHANGES,
)
async def update_structure(
    organization_id: UUID,
    claim_id: UUID,
    structure_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: StructureUpdate,
) -> StructureRead:
    structure = await service.update_structure(
        session, organization_id, claim_id, structure_id, body, user=user
    )
    return StructureRead.model_validate(structure)


@router.delete(
    "/structures/{structure_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a structure and its rooms",
    description=_CHANGES,
)
async def delete_structure(
    organization_id: UUID, claim_id: UUID, structure_id: UUID, session: DbSession, user: CurrentUser
) -> None:
    await service.delete_structure(session, organization_id, claim_id, structure_id, user=user)


@router.post(
    "/structures/{structure_id}/rooms",
    status_code=status.HTTP_201_CREATED,
    summary="Add a room to a structure",
    description="Names are unique per structure, ignoring case. Dimensions are in feet, to "
    f"the hundredth; floor area, wall area and volume are derived from them. {_CHANGES}",
)
async def create_room(
    organization_id: UUID,
    claim_id: UUID,
    structure_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: RoomCreate,
) -> RoomRead:
    room = await service.create_room(
        session, organization_id, claim_id, structure_id, body, user=user
    )
    return RoomRead.model_validate(room)


@router.get("/rooms/{room_id}", summary="Get a room")
async def get_room(
    organization_id: UUID, claim_id: UUID, room_id: UUID, session: DbSession, user: CurrentUser
) -> RoomRead:
    room = await service.get_room(session, organization_id, claim_id, room_id, user=user)
    return RoomRead.model_validate(room)


@router.patch(
    "/rooms/{room_id}",
    summary="Update or move a room",
    description="Only the fields sent change; `null` clears a dimension or the level. "
    f"`structure_id` moves the room to another structure of the same claim. {_CHANGES}",
)
async def update_room(
    organization_id: UUID,
    claim_id: UUID,
    room_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: RoomUpdate,
) -> RoomRead:
    room = await service.update_room(session, organization_id, claim_id, room_id, body, user=user)
    return RoomRead.model_validate(room)


@router.delete(
    "/rooms/{room_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a room",
    description=_CHANGES,
)
async def delete_room(
    organization_id: UUID, claim_id: UUID, room_id: UUID, session: DbSession, user: CurrentUser
) -> None:
    await service.delete_room(session, organization_id, claim_id, room_id, user=user)
