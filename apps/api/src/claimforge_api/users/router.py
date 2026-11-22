"""Endpoints about the signed-in user."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from claimforge_api.api.deps import DbSession, SettingsDep
from claimforge_api.api.problems import PROBLEM_RESPONSES
from claimforge_api.auth import refresh_tokens
from claimforge_api.auth.deps import CurrentUser
from claimforge_api.auth.limits import (
    PASSWORD_CHANGE_PER_IP,
    PASSWORD_CHANGE_PER_USER,
    LimiterDep,
    limit_by_ip,
)
from claimforge_api.auth.permissions import Permission, permissions_for
from claimforge_api.auth.schemas import TokenResponse
from claimforge_api.auth.sessions import UserAgent, start_session
from claimforge_api.core.rate_limit import enforce
from claimforge_api.organizations.models import Organization
from claimforge_api.users import service as users
from claimforge_api.users.models import Membership, Role, User

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


class MeUpdate(BaseModel):
    """Only the fields sent change."""

    model_config = ConfigDict(extra="forbid")

    full_name: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)
    ] = Field(examples=["Dana Whitfield"])


class PasswordChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Upper bounds stop multi-megabyte "passwords" from tying up the hasher.
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(
        min_length=1, max_length=128, description="Must meet the password policy"
    )


@router.get("/me", summary="The signed-in user and their organizations")
async def me(user: CurrentUser, session: DbSession) -> MeResponse:
    return await _me(session, user)


@router.patch("/me", summary="Change your name")
async def update_me(body: MeUpdate, user: CurrentUser, session: DbSession) -> MeResponse:
    """The name shows wherever you do: assignments, notes, the timeline."""
    await users.rename(session, user, body.full_name)
    return await _me(session, user)


@router.post(
    "/me/password",
    summary="Change your password",
    dependencies=[Depends(limit_by_ip("password-change", PASSWORD_CHANGE_PER_IP))],
)
async def change_password(
    body: PasswordChange,
    user: CurrentUser,
    session: DbSession,
    settings: SettingsDep,
    limiter: LimiterDep,
    response: Response,
    user_agent: UserAgent = None,
) -> TokenResponse:
    """Give the current password (`wrong_password` otherwise: 422, since you are signed in)
    and a new one that meets the policy (`weak_password`). Every session is signed out, and
    a new token pair comes back so this one carries on. Other devices' access tokens still
    work until they expire, within minutes; they can't be refreshed."""
    if settings.rate_limit_enabled:
        enforce(limiter, f"password-change:user:{user.id}", PASSWORD_CHANGE_PER_USER)
    await users.change_password(
        session, user, current_password=body.current_password, new_password=body.new_password
    )
    await refresh_tokens.revoke_all_for_user(session, user.id)
    return await start_session(session, response, settings, user.id, user_agent=user_agent)


async def _me(session: AsyncSession, user: User) -> MeResponse:
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
