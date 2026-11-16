"""HTTP endpoints for the organization's equipment inventory."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, status

from claimforge_api.api.deps import DbSession, PageParamsDep
from claimforge_api.api.problems import PROBLEM_RESPONSES
from claimforge_api.auth.deps import CurrentUser
from claimforge_api.db.pagination import CursorPage
from claimforge_api.equipment import service
from claimforge_api.equipment.schemas import (
    EquipmentCreate,
    EquipmentQuery,
    EquipmentRead,
    EquipmentUpdate,
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
