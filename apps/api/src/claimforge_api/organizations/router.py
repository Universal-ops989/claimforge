"""HTTP endpoints for organizations."""

from uuid import UUID

from fastapi import APIRouter, status

from claimforge_api.api.deps import DbSession, PageParamsDep
from claimforge_api.api.problems import PROBLEM_RESPONSES
from claimforge_api.auth.deps import CurrentUser
from claimforge_api.auth.permissions import permissions_for
from claimforge_api.db.pagination import CursorPage
from claimforge_api.organizations import service
from claimforge_api.organizations.schemas import (
    MemberPerson,
    MemberRead,
    OrganizationCreate,
    OrganizationRead,
    OrganizationUpdate,
)

router = APIRouter(prefix="/organizations", tags=["organizations"], responses=PROBLEM_RESPONSES)


@router.get("", summary="List organizations")
async def list_organizations(
    session: DbSession, user: CurrentUser, page: PageParamsDep
) -> CursorPage[OrganizationRead]:
    result = await service.list_organizations(
        session, user=user, limit=page.limit, cursor=page.cursor
    )
    return CursorPage[OrganizationRead](
        items=[OrganizationRead.model_validate(o) for o in result.items],
        next_cursor=result.next_cursor,
        has_more=result.has_more,
    )


@router.post("", status_code=status.HTTP_201_CREATED, summary="Create an organization")
async def create_organization(
    session: DbSession, user: CurrentUser, body: OrganizationCreate
) -> OrganizationRead:
    organization = await service.create_organization(session, body, owner=user)
    return OrganizationRead.model_validate(organization)


@router.get("/{organization_id}", summary="Get an organization")
async def get_organization(
    session: DbSession, user: CurrentUser, organization_id: UUID
) -> OrganizationRead:
    organization = await service.get_organization(session, organization_id, user=user)
    return OrganizationRead.model_validate(organization)


@router.patch("/{organization_id}", summary="Update an organization")
async def update_organization(
    session: DbSession, user: CurrentUser, organization_id: UUID, body: OrganizationUpdate
) -> OrganizationRead:
    organization = await service.update_organization(session, organization_id, body, user=user)
    return OrganizationRead.model_validate(organization)


@router.delete(
    "/{organization_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an organization (soft delete)",
)
async def delete_organization(session: DbSession, user: CurrentUser, organization_id: UUID) -> None:
    await service.delete_organization(session, organization_id, user=user)


@router.get(
    "/{organization_id}/members",
    summary="List members",
    description=(
        "Everyone in the organization, by name, with their role and what it allows: enough to "
        "pick someone for a claim. Needs `members:read`. No emails or other personal details."
    ),
)
async def list_members(
    session: DbSession, user: CurrentUser, organization_id: UUID
) -> list[MemberRead]:
    members = await service.list_members(session, user=user, organization_id=organization_id)
    return [
        MemberRead(
            user=MemberPerson.model_validate(member.user),
            role=member.role,
            permissions=sorted(permissions_for(member.role)),
            joined_at=member.created_at,
        )
        for member in members
    ]
