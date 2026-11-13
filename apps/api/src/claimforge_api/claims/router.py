"""HTTP endpoints for an organization's claims."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Path, Query, status

from claimforge_api.api.deps import DbSession, PageParamsDep
from claimforge_api.api.problems import PROBLEM_RESPONSES
from claimforge_api.auth.deps import CurrentUser
from claimforge_api.claims import service
from claimforge_api.claims.schemas import (
    ClaimContactLink,
    ClaimContactLinkUpdate,
    ClaimContactRead,
    ClaimCreate,
    ClaimListQuery,
    ClaimRead,
    ClaimStatusChangeCreate,
    ClaimStatusChangeRead,
    ClaimSummary,
    ClaimUpdate,
)
from claimforge_api.db.pagination import CursorPage

router = APIRouter(
    prefix="/organizations/{organization_id}/claims",
    tags=["claims"],
    responses=PROBLEM_RESPONSES,
)

ClaimNumber = Annotated[str, Path(max_length=20, examples=["2026-00042"])]


@router.get("", summary="List claims")
async def list_claims(
    organization_id: UUID,
    session: DbSession,
    user: CurrentUser,
    page: PageParamsDep,
    query: Annotated[ClaimListQuery, Query()],
) -> CursorPage[ClaimSummary]:
    result = await service.list_claims(
        session, organization_id, query, user=user, limit=page.limit, cursor=page.cursor
    )
    return CursorPage[ClaimSummary](
        items=[ClaimSummary.model_validate(c) for c in result.items],
        next_cursor=result.next_cursor,
        has_more=result.has_more,
    )


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create a claim",
    description="Give `property_id`, or an inline `property`; an inline address the "
    "organization already has reuses that property. The claim number is assigned here.",
)
async def create_claim(
    organization_id: UUID, session: DbSession, user: CurrentUser, body: ClaimCreate
) -> ClaimRead:
    claim = await service.create_claim(session, organization_id, body, user=user)
    return ClaimRead.model_validate(claim)


@router.get("/by-number/{number}", summary="Get a claim by its number")
async def get_claim_by_number(
    organization_id: UUID, number: ClaimNumber, session: DbSession, user: CurrentUser
) -> ClaimRead:
    claim = await service.get_claim_by_number(session, organization_id, number, user=user)
    return ClaimRead.model_validate(claim)


@router.get("/{claim_id}", summary="Get a claim")
async def get_claim(
    organization_id: UUID, claim_id: UUID, session: DbSession, user: CurrentUser
) -> ClaimRead:
    claim = await service.get_claim(session, organization_id, claim_id, user=user)
    return ClaimRead.model_validate(claim)


@router.patch(
    "/{claim_id}",
    summary="Edit a claim's details",
    description="Omitted fields are unchanged; `null` clears an optional field. The number "
    "never changes, and status, property and contacts have their own endpoints.",
)
async def update_claim(
    organization_id: UUID,
    claim_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: ClaimUpdate,
) -> ClaimRead:
    claim = await service.update_claim(session, organization_id, claim_id, body, user=user)
    return ClaimRead.model_validate(claim)


@router.post(
    "/{claim_id}/status",
    summary="Change a claim's status",
    description="Moves along the status workflow; the claim's `next_statuses` lists where "
    "it can go. Putting a claim on hold, cancelling, reopening and reinstating need a "
    "`reason`. Reopening a closed claim or reinstating a cancelled one needs "
    "`claims:reopen`. Closed and cancelled claims are read-only until then.",
)
async def change_claim_status(
    organization_id: UUID,
    claim_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: ClaimStatusChangeCreate,
) -> ClaimRead:
    claim = await service.change_status(session, organization_id, claim_id, body, user=user)
    return ClaimRead.model_validate(claim)


@router.get("/{claim_id}/status-history", summary="A claim's status changes, oldest first")
async def get_claim_status_history(
    organization_id: UUID, claim_id: UUID, session: DbSession, user: CurrentUser
) -> list[ClaimStatusChangeRead]:
    changes = await service.status_history(session, organization_id, claim_id, user=user)
    return [ClaimStatusChangeRead.model_validate(c) for c in changes]


@router.post(
    "/{claim_id}/contacts",
    status_code=status.HTTP_201_CREATED,
    summary="Link a contact to a claim",
)
async def link_claim_contact(
    organization_id: UUID,
    claim_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: ClaimContactLink,
) -> ClaimContactRead:
    link = await service.link_contact(session, organization_id, claim_id, body, user=user)
    return ClaimContactRead.model_validate(link)


@router.patch(
    "/{claim_id}/contacts/{contact_id}",
    summary="Change a contact's role on a claim",
    description="`is_primary: true` makes this the primary contact and demotes the previous one.",
)
async def update_claim_contact(
    organization_id: UUID,
    claim_id: UUID,
    contact_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: ClaimContactLinkUpdate,
) -> ClaimContactRead:
    link = await service.update_contact_link(
        session, organization_id, claim_id, contact_id, body, user=user
    )
    return ClaimContactRead.model_validate(link)


@router.delete(
    "/{claim_id}/contacts/{contact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Unlink a contact from a claim",
)
async def unlink_claim_contact(
    organization_id: UUID, claim_id: UUID, contact_id: UUID, session: DbSession, user: CurrentUser
) -> None:
    await service.unlink_contact(session, organization_id, claim_id, contact_id, user=user)
