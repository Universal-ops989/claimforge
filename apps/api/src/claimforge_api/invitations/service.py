"""Invite people to an organization and let them accept."""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.auth.permissions import Permission, authorize, permissions_for
from claimforge_api.core.errors import (
    AppError,
    BusinessRuleError,
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
)
from claimforge_api.core.settings import Settings
from claimforge_api.invitations.delivery import InvitationMessage, InvitationSender
from claimforge_api.invitations.models import Invitation
from claimforge_api.organizations.models import Organization
from claimforge_api.users import service as users
from claimforge_api.users.models import Membership, Role, User

INVITATION_TTL = timedelta(days=7)


class AlreadyMemberError(ConflictError):
    code = "already_member"
    title = "Already a member"


class InvitationUnavailableError(AppError):
    status = 410
    code = "invitation_unavailable"
    title = "Invitation unavailable"


class InvitationAccountMismatchError(PermissionDeniedError):
    code = "invitation_account_mismatch"
    title = "Invitation is for a different account"


class PasswordRequiredError(BusinessRuleError):
    code = "password_required"
    title = "Choose a password"


class SignInRequiredError(ConflictError):
    code = "sign_in_to_accept"
    title = "Sign in to accept"


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def invite(
    session: AsyncSession,
    *,
    inviter: User,
    organization_id: UUID,
    email: str,
    role: Role,
    settings: Settings,
    sender: InvitationSender,
    now: datetime | None = None,
) -> Invitation:
    """Create (or re-issue) a pending invitation and send its link."""
    now = now or datetime.now(UTC)
    membership = await authorize(session, inviter, organization_id, Permission.MEMBERS_MANAGE)
    # Nobody can hand out more power than they hold (admins cannot create owners).
    if not permissions_for(role) <= permissions_for(membership.role):
        raise PermissionDeniedError(
            f"A {membership.role} cannot invite someone as {role}", requested_role=role.value
        )

    email = users.normalize_email(email)
    existing_user = await users.find_live_user_by_email(session, email)
    if existing_user is not None:
        already = await session.scalar(
            select(Membership.id).where(
                Membership.organization_id == organization_id,
                Membership.user_id == existing_user.id,
            )
        )
        if already is not None:
            raise AlreadyMemberError(f"{email} is already a member", email=email)

    token = secrets.token_urlsafe(32)
    invitation = await session.scalar(
        select(Invitation).where(
            Invitation.organization_id == organization_id,
            func.lower(Invitation.email) == email,
            Invitation.accepted_at.is_(None),
            Invitation.revoked_at.is_(None),
        )
    )
    if invitation is None:
        invitation = Invitation(organization_id=organization_id, email=email)
        session.add(invitation)
    # Re-inviting refreshes the role, token and expiry of the pending invitation.
    invitation.role = role
    invitation.token_hash = _hash(token)
    invitation.invited_by_id = inviter.id
    invitation.expires_at = now + INVITATION_TTL
    await session.flush()

    organization = await session.get_one(Organization, organization_id)
    accept_url = (
        f"{settings.web_app_url.rstrip('/')}/invitations/accept?{urlencode({'token': token})}"
    )
    await session.commit()
    await sender.send(
        InvitationMessage(
            email=email,
            organization_name=organization.name,
            inviter_name=inviter.full_name,
            role=role.value,
            accept_url=accept_url,
        )
    )
    return invitation


async def list_pending(
    session: AsyncSession, *, user: User, organization_id: UUID
) -> list[Invitation]:
    await authorize(session, user, organization_id, Permission.MEMBERS_MANAGE)
    rows = await session.scalars(
        select(Invitation)
        .where(
            Invitation.organization_id == organization_id,
            Invitation.accepted_at.is_(None),
            Invitation.revoked_at.is_(None),
        )
        .order_by(Invitation.id.desc())
    )
    return list(rows)


async def revoke(
    session: AsyncSession,
    *,
    user: User,
    organization_id: UUID,
    invitation_id: UUID,
    now: datetime | None = None,
) -> None:
    await authorize(session, user, organization_id, Permission.MEMBERS_MANAGE)
    invitation = await session.scalar(
        select(Invitation).where(
            Invitation.id == invitation_id, Invitation.organization_id == organization_id
        )
    )
    if invitation is None or not invitation.is_pending:
        raise NotFoundError("Invitation not found", invitation_id=str(invitation_id))
    invitation.revoked_at = now or datetime.now(UTC)
    await session.commit()


async def accept(
    session: AsyncSession,
    *,
    token: str,
    current_user: User | None,
    full_name: str | None = None,
    password: str | None = None,
    now: datetime | None = None,
) -> User:
    """Join the organization. New people create an account; existing users must sign in."""
    now = now or datetime.now(UTC)
    invitation = await session.scalar(
        select(Invitation).where(Invitation.token_hash == _hash(token)).with_for_update()
    )
    if invitation is None or not invitation.is_pending or invitation.expires_at <= now:
        raise InvitationUnavailableError(
            "This invitation has expired or was already used. Ask for a new one."
        )

    existing = await users.find_live_user_by_email(session, invitation.email)
    if existing is not None:
        if current_user is None:
            raise SignInRequiredError(
                "An account with this email exists. Sign in, then accept the invitation."
            )
        if current_user.id != existing.id:
            raise InvitationAccountMismatchError(
                "You are signed in with a different account than the one invited"
            )
        user = existing
    else:
        if (
            current_user is not None
            and users.normalize_email(current_user.email) != invitation.email
        ):
            raise InvitationAccountMismatchError(
                "You are signed in with a different account than the one invited"
            )
        if not password:
            raise PasswordRequiredError("Choose a password to create your account")
        user = await users.create_user(
            session,
            email=invitation.email,
            full_name=full_name or invitation.email.split("@", 1)[0],
            password=password,
        )

    session.add(
        Membership(
            organization_id=invitation.organization_id, user_id=user.id, role=invitation.role
        )
    )
    invitation.accepted_at = now
    await session.commit()
    return user
