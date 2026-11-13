"""HTTP endpoints for an organization's properties (loss locations)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, status

from claimforge_api.api.deps import DbSession, PageParamsDep
from claimforge_api.api.problems import PROBLEM_RESPONSES
from claimforge_api.auth.deps import CurrentUser
from claimforge_api.db.pagination import CursorPage
from claimforge_api.properties import service
from claimforge_api.properties.schemas import PropertyCreate, PropertyRead, PropertyUpdate

router = APIRouter(
    prefix="/organizations/{organization_id}/properties",
    tags=["properties"],
    responses=PROBLEM_RESPONSES,
)


@router.get("", summary="List properties (newest first)")
async def list_properties(
    organization_id: UUID,
    session: DbSession,
    user: CurrentUser,
    page: PageParamsDep,
    q: Annotated[
        str | None, Query(max_length=200, description="Matches street, unit, city or postal code")
    ] = None,
    postal_code: Annotated[
        str | None, Query(max_length=16, description="Postal code or its prefix, e.g. 787")
    ] = None,
) -> CursorPage[PropertyRead]:
    result = await service.list_properties(
        session,
        organization_id,
        user=user,
        q=q,
        postal_code=postal_code,
        limit=page.limit,
        cursor=page.cursor,
    )
    return CursorPage[PropertyRead](
        items=[PropertyRead.model_validate(p) for p in result.items],
        next_cursor=result.next_cursor,
        has_more=result.has_more,
    )


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create a property",
    description="Returns 409 `property_exists`, with `existing_property_id`, when the "
    "organization already has a property at the same normalized address.",
)
async def create_property(
    organization_id: UUID, session: DbSession, user: CurrentUser, body: PropertyCreate
) -> PropertyRead:
    prop = await service.create_property(session, organization_id, body, user=user)
    return PropertyRead.model_validate(prop)


@router.get("/{property_id}", summary="Get a property")
async def get_property(
    organization_id: UUID, property_id: UUID, session: DbSession, user: CurrentUser
) -> PropertyRead:
    prop = await service.get_property(session, organization_id, property_id, user=user)
    return PropertyRead.model_validate(prop)


@router.patch("/{property_id}", summary="Update a property")
async def update_property(
    organization_id: UUID,
    property_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: PropertyUpdate,
) -> PropertyRead:
    prop = await service.update_property(session, organization_id, property_id, body, user=user)
    return PropertyRead.model_validate(prop)


@router.delete(
    "/{property_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a property (soft delete)",
)
async def delete_property(
    organization_id: UUID, property_id: UUID, session: DbSession, user: CurrentUser
) -> None:
    await service.delete_property(session, organization_id, property_id, user=user)
