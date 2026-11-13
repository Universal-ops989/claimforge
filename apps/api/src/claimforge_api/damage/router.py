"""HTTP endpoints for the damage recorded in a claim's rooms."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, status

from claimforge_api.api.deps import DbSession
from claimforge_api.api.problems import PROBLEM_RESPONSES
from claimforge_api.auth.deps import CurrentUser
from claimforge_api.damage import service
from claimforge_api.damage.schemas import (
    DamageItemCreate,
    DamageItemQuery,
    DamageItemRead,
    DamageItemUpdate,
)

router = APIRouter(
    prefix="/organizations/{organization_id}/claims/{claim_id}",
    tags=["damage"],
    responses=PROBLEM_RESPONSES,
)

_CHANGES = "Needs `field_data:write`. Closed and cancelled claims are read-only (`claim_locked`)."


@router.get(
    "/damage-items",
    summary="List a claim's damage items",
    description="Grouped by room, in the order the rooms were added.",
)
async def list_damage_items(
    organization_id: UUID,
    claim_id: UUID,
    session: DbSession,
    user: CurrentUser,
    query: Annotated[DamageItemQuery, Query()],
) -> list[DamageItemRead]:
    items = await service.list_items(session, organization_id, claim_id, query, user=user)
    return [DamageItemRead.model_validate(i) for i in items]


@router.post(
    "/rooms/{room_id}/damage-items",
    status_code=status.HTTP_201_CREATED,
    summary="Record damage in a room",
    description=_CHANGES,
)
async def create_damage_item(
    organization_id: UUID,
    claim_id: UUID,
    room_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: DamageItemCreate,
) -> DamageItemRead:
    item = await service.create_item(session, organization_id, claim_id, room_id, body, user=user)
    return DamageItemRead.model_validate(item)


@router.get("/damage-items/{damage_item_id}", summary="Get a damage item")
async def get_damage_item(
    organization_id: UUID,
    claim_id: UUID,
    damage_item_id: UUID,
    session: DbSession,
    user: CurrentUser,
) -> DamageItemRead:
    item = await service.get_item(session, organization_id, claim_id, damage_item_id, user=user)
    return DamageItemRead.model_validate(item)


@router.patch(
    "/damage-items/{damage_item_id}",
    summary="Update or move a damage item",
    description=_CHANGES,
)
async def update_damage_item(
    organization_id: UUID,
    claim_id: UUID,
    damage_item_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: DamageItemUpdate,
) -> DamageItemRead:
    item = await service.update_item(
        session, organization_id, claim_id, damage_item_id, body, user=user
    )
    return DamageItemRead.model_validate(item)


@router.delete(
    "/damage-items/{damage_item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a damage item",
    description=_CHANGES,
)
async def delete_damage_item(
    organization_id: UUID,
    claim_id: UUID,
    damage_item_id: UUID,
    session: DbSession,
    user: CurrentUser,
) -> None:
    await service.delete_item(session, organization_id, claim_id, damage_item_id, user=user)
