"""HTTP endpoints for invitations."""

from datetime import datetime
from typing import Annotated, cast
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from claimforge_api.api.deps import DbSession, SettingsDep
from claimforge_api.api.problems import PROBLEM_RESPONSES, RATE_LIMITED_RESPONSE
from claimforge_api.auth.deps import CurrentUser, OptionalCurrentUser
from claimforge_api.auth.limits import INVITATION_ACCEPT_PER_IP, limit_by_ip
from claimforge_api.auth.schemas import TokenResponse
from claimforge_api.auth.sessions import UserAgent, start_session
from claimforge_api.invitations import service
from claimforge_api.invitations.delivery import InvitationSender
from claimforge_api.users.models import Role


def get_invitation_sender(request: Request) -> InvitationSender:
    return cast("InvitationSender", request.app.state.invitation_sender)


SenderDep = Annotated[InvitationSender, Depends(get_invitation_sender)]


class InvitationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    role: Role


class InvitationRead(BaseModel):
    """Never includes the token: links only travel by email."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    role: Role
    expires_at: datetime
    created_at: datetime


class InvitationAccept(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=1, max_length=200)
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    password: str | None = Field(default=None, max_length=128)


organization_router = APIRouter(
    prefix="/organizations/{organization_id}/invitations",
    tags=["invitations"],
    responses=PROBLEM_RESPONSES,
)


@organization_router.post("", status_code=status.HTTP_201_CREATED, summary="Invite someone")
async def create_invitation(
    organization_id: UUID,
    body: InvitationCreate,
    user: CurrentUser,
    session: DbSession,
    settings: SettingsDep,
    sender: SenderDep,
) -> InvitationRead:
    invitation = await service.invite(
        session,
        inviter=user,
        organization_id=organization_id,
        email=body.email,
        role=body.role,
        settings=settings,
        sender=sender,
    )
    return InvitationRead.model_validate(invitation)


@organization_router.get("", summary="List pending invitations")
async def list_invitations(
    organization_id: UUID, user: CurrentUser, session: DbSession
) -> list[InvitationRead]:
    pending = await service.list_pending(session, user=user, organization_id=organization_id)
    return [InvitationRead.model_validate(i) for i in pending]


@organization_router.delete(
    "/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Revoke an invitation"
)
async def revoke_invitation(
    organization_id: UUID, invitation_id: UUID, user: CurrentUser, session: DbSession
) -> None:
    await service.revoke(
        session, user=user, organization_id=organization_id, invitation_id=invitation_id
    )


accept_router = APIRouter(prefix="/invitations", tags=["invitations"], responses=PROBLEM_RESPONSES)


@accept_router.post(
    "/accept",
    summary="Accept an invitation and sign in",
    dependencies=[Depends(limit_by_ip("invitation-accept", INVITATION_ACCEPT_PER_IP))],
    responses=RATE_LIMITED_RESPONSE,
)
async def accept_invitation(
    body: InvitationAccept,
    current_user: OptionalCurrentUser,
    session: DbSession,
    settings: SettingsDep,
    response: Response,
    user_agent: UserAgent = None,
) -> TokenResponse:
    user = await service.accept(
        session,
        token=body.token,
        current_user=current_user,
        full_name=body.full_name,
        password=body.password,
    )
    return await start_session(session, response, settings, user.id, user_agent=user_agent)
