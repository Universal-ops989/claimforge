"""Endpoints about the signed-in user."""

from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from claimforge_api.api.deps import DbSession
from claimforge_api.api.problems import PROBLEM_RESPONSES
from claimforge_api.auth.deps import CurrentUser
from claimforge_api.auth.permissions import Permission, permissions_for
from claimforge_api.organizations.models import Organization
from claimforge_api.users.models import Membership, Role

router = APIRouter(tags=["me"], responses=PROBLEM_RESPONSES)


class MembershipOrganization(BaseModel):
    id: UUID
    name: str
    slug: str


class MembershipRead(BaseModel):
    organization: MembershipOrganization
    role: Role
    permissions: list[Permission]


class MeResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    memberships: list[MembershipRead]


@router.get("/me", summary="The signed-in user and their organizations")
async def me(user: CurrentUser, session: DbSession) -> MeResponse:
    memberships = await session.scalars(
        select(Membership)
        .join(Organization, Organization.id == Membership.organization_id)
        .where(Membership.user_id == user.id, Organization.not_deleted())
        .options(selectinload(Membership.organization))
        .order_by(Organization.name)
    )
    return MeResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        memberships=[
            MembershipRead(
                organization=MembershipOrganization(
                    id=m.organization.id, name=m.organization.name, slug=m.organization.slug
                ),
                role=Role(m.role),
                permissions=sorted(permissions_for(m.role)),
            )
            for m in memberships
        ],
    )
