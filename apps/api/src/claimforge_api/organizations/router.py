"""HTTP endpoints for organizations."""

from uuid import UUID

from fastapi import APIRouter, status

from claimforge_api.api.deps import DbSession, PageParamsDep
from claimforge_api.api.problems import PROBLEM_RESPONSES
from claimforge_api.auth.deps import CurrentUser
from claimforge_api.auth.permissions import permissions_for
from claimforge_api.db.pagination import CursorPage
from claimforge_api.organizations import members, service
from claimforge_api.organizations.schemas import (
    MemberPerson,
    MemberRead,
    MemberUpdate,
    OrganizationCreate,
    OrganizationRead,
    OrganizationUpdate,
)
from claimforge_api.users.models import Membership

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
    found = await service.list_members(session, user=user, organization_id=organization_id)
    return [_member(member) for member in found]


@router.patch(
    "/{organization_id}/members/{user_id}",
    summary="Change a member's role",
    description=(
        "Needs `members:manage`. Nobody hands out more than they hold or changes someone who "
        "holds more (`permission_denied`: an admin can't touch an owner). The last owner stays "
        "an owner (`last_owner`). A role that can't do the member's claim assignments or open "
        "tasks is refused (`member_has_work`, with `assignments` and `open_tasks`): unassign "
        "them first."
    ),
)
async def change_member_role(
    session: DbSession, user: CurrentUser, organization_id: UUID, user_id: UUID, body: MemberUpdate
) -> MemberRead:
    member = await members.change_role(
        session, user=user, organization_id=organization_id, member_id=user_id, role=body.role
    )
    return _member(member)


@router.delete(
    "/{organization_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a member, or leave",
    description=(
        "Needs `members:manage`, except to leave (your own id). Not someone who holds more "
        "than you; never the last owner (`last_owner`). Their claim assignments end; their "
        "tasks stay on the claims, unassigned."
    ),
)
async def remove_member(
    session: DbSession, user: CurrentUser, organization_id: UUID, user_id: UUID
) -> None:
    await members.remove(session, user=user, organization_id=organization_id, member_id=user_id)


def _member(member: Membership) -> MemberRead:
    return MemberRead(
        user=MemberPerson.model_validate(member.user),
        role=member.role,
        permissions=sorted(permissions_for(member.role)),
        joined_at=member.created_at,
    )
