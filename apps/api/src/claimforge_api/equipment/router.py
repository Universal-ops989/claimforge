"""HTTP endpoints for the equipment inventory and its placements on claims."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, status

from claimforge_api.api.deps import DbSession, PageParamsDep
from claimforge_api.api.problems import PROBLEM_RESPONSES
from claimforge_api.auth.deps import CurrentUser
from claimforge_api.db.pagination import CursorPage
from claimforge_api.equipment import placements, service
from claimforge_api.equipment.schemas import (
    EquipmentCreate,
    EquipmentDays,
    EquipmentQuery,
    EquipmentRead,
    EquipmentUpdate,
    PlacementCreate,
    PlacementQuery,
    PlacementRead,
    PlacementRemove,
    PlacementUpdate,
)

router = APIRouter(
    prefix="/organizations/{organization_id}/equipment",
    tags=["equipment"],
    responses=PROBLEM_RESPONSES,
)


@router.get("", summary="List equipment", description="By asset tag.")
async def list_equipment(
    organization_id: UUID,
    session: DbSession,
    user: CurrentUser,
    page: PageParamsDep,
    query: Annotated[EquipmentQuery, Query()],
) -> CursorPage[EquipmentRead]:
    result = await service.list_equipment(
        session, organization_id, query, user=user, limit=page.limit, cursor=page.cursor
    )
    return CursorPage[EquipmentRead](
        items=[EquipmentRead.model_validate(unit) for unit in result.items],
        next_cursor=result.next_cursor,
        has_more=result.has_more,
    )


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Add equipment",
    description="Needs `field_data:write`. Asset tags are unique in the organization, "
    "ignoring case (`asset_tag_taken`).",
)
async def create_equipment(
    organization_id: UUID, session: DbSession, user: CurrentUser, body: EquipmentCreate
) -> EquipmentRead:
    unit = await service.create_equipment(session, organization_id, body, user=user)
    return EquipmentRead.model_validate(unit)


@router.get("/{equipment_id}", summary="Get equipment")
async def get_equipment(
    organization_id: UUID, equipment_id: UUID, session: DbSession, user: CurrentUser
) -> EquipmentRead:
    unit = await service.get_equipment(session, organization_id, equipment_id, user=user)
    return EquipmentRead.model_validate(unit)


@router.patch(
    "/{equipment_id}",
    summary="Edit equipment",
    description="Only the fields sent change. Set `status` to `maintenance` while a unit is "
    "being repaired and `retired` when it leaves the fleet.",
)
async def update_equipment(
    organization_id: UUID,
    equipment_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: EquipmentUpdate,
) -> EquipmentRead:
    unit = await service.update_equipment(session, organization_id, equipment_id, body, user=user)
    return EquipmentRead.model_validate(unit)


@router.delete(
    "/{equipment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete equipment",
    description="For units added by mistake; retire units that are leaving the fleet.",
)
async def delete_equipment(
    organization_id: UUID, equipment_id: UUID, session: DbSession, user: CurrentUser
) -> None:
    await service.delete_equipment(session, organization_id, equipment_id, user=user)


claim_router = APIRouter(
    prefix="/organizations/{organization_id}/claims/{claim_id}",
    tags=["equipment"],
    responses=PROBLEM_RESPONSES,
)


@claim_router.get(
    "/equipment-placements",
    summary="List a claim's equipment placements",
    description="In the order units were placed. `running=true` for what's on site now.",
)
async def list_equipment_placements(
    organization_id: UUID,
    claim_id: UUID,
    session: DbSession,
    user: CurrentUser,
    query: Annotated[PlacementQuery, Query()],
) -> list[PlacementRead]:
    found = await placements.list_placements(session, organization_id, claim_id, query, user=user)
    return [PlacementRead.model_validate(p) for p in found]


@claim_router.post(
    "/equipment-placements",
    status_code=status.HTTP_201_CREATED,
    summary="Place equipment in a room",
    description="Needs `field_data:write`. The unit must be in service "
    "(`equipment_unavailable`) and not running elsewhere (`equipment_running`, with the "
    "claim's id and number). `placed_at` defaults to now and can be earlier, not later "
    "(`time_in_future`). Closed and cancelled claims are read-only (`claim_locked`).",
)
async def place_equipment(
    organization_id: UUID,
    claim_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: PlacementCreate,
) -> PlacementRead:
    placement = await placements.place(session, organization_id, claim_id, body, user=user)
    return PlacementRead.model_validate(placement)


@claim_router.post(
    "/equipment-placements/{placement_id}/remove",
    summary="Remove equipment",
    description="Records when the unit was pulled (default now). Works on closed claims "
    "too, so a unit is never stranded on a finished job. Already removed: `already_removed`.",
)
async def remove_equipment(
    organization_id: UUID,
    claim_id: UUID,
    placement_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: PlacementRemove,
) -> PlacementRead:
    placement = await placements.remove(
        session, organization_id, claim_id, placement_id, body, user=user
    )
    return PlacementRead.model_validate(placement)


@claim_router.patch(
    "/equipment-placements/{placement_id}",
    summary="Correct an equipment placement",
    description="Only the fields sent change. `removed_at: null` puts a unit pulled by "
    "mistake back to running, if it isn't running elsewhere.",
)
async def update_equipment_placement(
    organization_id: UUID,
    claim_id: UUID,
    placement_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: PlacementUpdate,
) -> PlacementRead:
    placement = await placements.update_placement(
        session, organization_id, claim_id, placement_id, body, user=user
    )
    return PlacementRead.model_validate(placement)


@claim_router.delete(
    "/equipment-placements/{placement_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an equipment placement",
    description="For placements entered by mistake; they no longer count towards billing.",
)
async def delete_equipment_placement(
    organization_id: UUID,
    claim_id: UUID,
    placement_id: UUID,
    session: DbSession,
    user: CurrentUser,
) -> None:
    await placements.delete_placement(session, organization_id, claim_id, placement_id, user=user)


@claim_router.get(
    "/equipment-days",
    summary="Equipment-days by kind",
    description="What the claim's estimate bills: placements, units still running, and "
    "billable days per kind (every started 24 hours; running units counted up to now).",
)
async def get_equipment_days(
    organization_id: UUID, claim_id: UUID, session: DbSession, user: CurrentUser
) -> list[EquipmentDays]:
    return await placements.equipment_days_by_kind(session, organization_id, claim_id, user=user)
