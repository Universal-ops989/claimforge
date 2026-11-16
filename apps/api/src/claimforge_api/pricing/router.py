"""HTTP endpoints for the organization's price lists and their items."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, status

from claimforge_api.api.deps import DbSession, PageParamsDep
from claimforge_api.api.problems import PROBLEM_RESPONSES
from claimforge_api.auth.deps import CurrentUser
from claimforge_api.db.pagination import CursorPage
from claimforge_api.pricing import service
from claimforge_api.pricing.schemas import (
    PriceItemCreate,
    PriceItemQuery,
    PriceItemRead,
    PriceItemUpdate,
    PriceListCreate,
    PriceListRead,
    PriceListUpdate,
)

router = APIRouter(
    prefix="/organizations/{organization_id}/price-lists",
    tags=["pricing"],
    responses=PROBLEM_RESPONSES,
)


@router.get("", summary="List price lists", description="The default first, then by name.")
async def list_price_lists(
    organization_id: UUID, session: DbSession, user: CurrentUser
) -> list[PriceListRead]:
    return await service.list_price_lists(session, organization_id, user=user)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create a price list",
    description="Needs `estimates:write`. Names are unique in the organization, ignoring "
    "case (`price_list_name_taken`). `is_default: true` takes over from the current default.",
)
async def create_price_list(
    organization_id: UUID, session: DbSession, user: CurrentUser, body: PriceListCreate
) -> PriceListRead:
    price_list = await service.create_price_list(session, organization_id, body, user=user)
    return await service.present(session, price_list)


@router.get("/{list_id}", summary="Get a price list")
async def get_price_list(
    organization_id: UUID, list_id: UUID, session: DbSession, user: CurrentUser
) -> PriceListRead:
    price_list = await service.get_price_list(session, organization_id, list_id, user=user)
    return await service.present(session, price_list)


@router.patch("/{list_id}", summary="Edit a price list")
async def update_price_list(
    organization_id: UUID,
    list_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: PriceListUpdate,
) -> PriceListRead:
    price_list = await service.update_price_list(session, organization_id, list_id, body, user=user)
    return await service.present(session, price_list)


@router.delete(
    "/{list_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a price list and its items",
)
async def delete_price_list(
    organization_id: UUID, list_id: UUID, session: DbSession, user: CurrentUser
) -> None:
    await service.delete_price_list(session, organization_id, list_id, user=user)


@router.get(
    "/{list_id}/items",
    summary="List a price list's items",
    description="By code. `q` matches code or description; `category` filters exactly.",
)
async def list_price_items(
    organization_id: UUID,
    list_id: UUID,
    session: DbSession,
    user: CurrentUser,
    page: PageParamsDep,
    query: Annotated[PriceItemQuery, Query()],
) -> CursorPage[PriceItemRead]:
    result = await service.list_items(
        session, organization_id, list_id, query, user=user, limit=page.limit, cursor=page.cursor
    )
    return CursorPage[PriceItemRead](
        items=[PriceItemRead.model_validate(item) for item in result.items],
        next_cursor=result.next_cursor,
        has_more=result.has_more,
    )


@router.post(
    "/{list_id}/items",
    status_code=status.HTTP_201_CREATED,
    summary="Add a price item",
    description="Needs `estimates:write`. Codes are unique in the list, ignoring case "
    "(`price_code_taken`). Prices are decimal strings to the cent.",
)
async def create_price_item(
    organization_id: UUID,
    list_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: PriceItemCreate,
) -> PriceItemRead:
    item = await service.create_item(session, organization_id, list_id, body, user=user)
    return PriceItemRead.model_validate(item)


@router.get("/{list_id}/items/{item_id}", summary="Get a price item")
async def get_price_item(
    organization_id: UUID, list_id: UUID, item_id: UUID, session: DbSession, user: CurrentUser
) -> PriceItemRead:
    item = await service.get_item(session, organization_id, list_id, item_id, user=user)
    return PriceItemRead.model_validate(item)


@router.patch("/{list_id}/items/{item_id}", summary="Edit a price item")
async def update_price_item(
    organization_id: UUID,
    list_id: UUID,
    item_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: PriceItemUpdate,
) -> PriceItemRead:
    item = await service.update_item(session, organization_id, list_id, item_id, body, user=user)
    return PriceItemRead.model_validate(item)


@router.delete(
    "/{list_id}/items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a price item",
)
async def delete_price_item(
    organization_id: UUID, list_id: UUID, item_id: UUID, session: DbSession, user: CurrentUser
) -> None:
    await service.delete_item(session, organization_id, list_id, item_id, user=user)
