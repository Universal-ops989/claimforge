"""HTTP endpoints for an organization's contacts."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, status

from claimforge_api.api.deps import DbSession, PageParamsDep
from claimforge_api.api.problems import PROBLEM_RESPONSES
from claimforge_api.auth.deps import CurrentUser
from claimforge_api.contacts import service
from claimforge_api.contacts.models import ContactKind
from claimforge_api.contacts.schemas import ContactCreate, ContactRead, ContactUpdate
from claimforge_api.db.pagination import CursorPage

router = APIRouter(
    prefix="/organizations/{organization_id}/contacts",
    tags=["contacts"],
    responses=PROBLEM_RESPONSES,
)


@router.get("", summary="List contacts (alphabetical)")
async def list_contacts(
    organization_id: UUID,
    session: DbSession,
    user: CurrentUser,
    page: PageParamsDep,
    kind: ContactKind | None = None,
    q: Annotated[
        str | None,
        Query(max_length=200, description="Matches name, company, email or phone digits"),
    ] = None,
) -> CursorPage[ContactRead]:
    result = await service.list_contacts(
        session,
        organization_id,
        user=user,
        kind=kind,
        q=q,
        limit=page.limit,
        cursor=page.cursor,
    )
    return CursorPage[ContactRead](
        items=[ContactRead.model_validate(c) for c in result.items],
        next_cursor=result.next_cursor,
        has_more=result.has_more,
    )


@router.post("", status_code=status.HTTP_201_CREATED, summary="Create a contact")
async def create_contact(
    organization_id: UUID, session: DbSession, user: CurrentUser, body: ContactCreate
) -> ContactRead:
    contact = await service.create_contact(session, organization_id, body, user=user)
    return ContactRead.model_validate(contact)


@router.get("/{contact_id}", summary="Get a contact")
async def get_contact(
    organization_id: UUID, contact_id: UUID, session: DbSession, user: CurrentUser
) -> ContactRead:
    contact = await service.get_contact(session, organization_id, contact_id, user=user)
    return ContactRead.model_validate(contact)


@router.patch("/{contact_id}", summary="Update a contact")
async def update_contact(
    organization_id: UUID,
    contact_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: ContactUpdate,
) -> ContactRead:
    contact = await service.update_contact(session, organization_id, contact_id, body, user=user)
    return ContactRead.model_validate(contact)


@router.delete(
    "/{contact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a contact (soft delete)",
)
async def delete_contact(
    organization_id: UUID, contact_id: UUID, session: DbSession, user: CurrentUser
) -> None:
    await service.delete_contact(session, organization_id, contact_id, user=user)
