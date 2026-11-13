"""Refresh-token rotation with reuse detection.

Each refresh replaces the presented token with a new one in the same *family*. A token that
has already been replaced must never be presented again; if it is, someone holds a copy,
so the whole family is revoked and the user has to sign in again.
"""

import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.auth.models import RefreshToken
from claimforge_api.core.errors import AuthenticationRequiredError
from claimforge_api.core.ids import uuid7
from claimforge_api.core.settings import Settings
from claimforge_api.users.models import User


class InvalidRefreshTokenError(AuthenticationRequiredError):
    code = "invalid_refresh_token"
    title = "Session expired"


class RefreshTokenReusedError(AuthenticationRequiredError):
    code = "refresh_token_reused"
    title = "Session revoked"


@dataclass(frozen=True)
class IssuedRefreshToken:
    token: str  # raw value, shown to the client once
    record: RefreshToken


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


async def issue(
    session: AsyncSession,
    user_id: UUID,
    settings: Settings,
    *,
    family_id: UUID | None = None,
    user_agent: str | None = None,
    now: datetime | None = None,
) -> IssuedRefreshToken:
    """Create a refresh token; a new ``family_id`` starts a new session."""
    raw = secrets.token_urlsafe(32)
    record = RefreshToken(
        user_id=user_id,
        family_id=family_id or uuid7(),
        token_hash=hash_token(raw),
        expires_at=(now or datetime.now(UTC)) + timedelta(days=settings.refresh_token_ttl_days),
        user_agent=(user_agent or "")[:255] or None,
    )
    session.add(record)
    await session.flush()
    return IssuedRefreshToken(token=raw, record=record)


async def _revoke_family(session: AsyncSession, family_id: UUID, at: datetime) -> None:
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=at)
    )


async def rotate(
    session: AsyncSession,
    raw: str,
    settings: Settings,
    *,
    user_agent: str | None = None,
    now: datetime | None = None,
) -> tuple[User, IssuedRefreshToken]:
    """Exchange a valid refresh token for its successor. Commits."""
    now = now or datetime.now(UTC)
    current = await session.scalar(
        select(RefreshToken)
        .where(RefreshToken.token_hash == hash_token(raw))
        # Lock the row: two concurrent refreshes must not both succeed.
        .with_for_update()
    )
    if current is None:
        raise InvalidRefreshTokenError("Sign in again")

    if current.revoked_at is not None:
        await _revoke_family(session, current.family_id, now)
        await session.commit()
        raise RefreshTokenReusedError(
            "This session was revoked because an old token was reused. Sign in again."
        )

    user = await session.get(User, current.user_id)
    if current.expires_at <= now or user is None or user.is_deleted or not user.is_active:
        await _revoke_family(session, current.family_id, now)
        await session.commit()
        raise InvalidRefreshTokenError("Sign in again")

    successor = await issue(
        session,
        current.user_id,
        settings,
        family_id=current.family_id,
        user_agent=user_agent,
        now=now,
    )
    current.revoked_at = now
    current.replaced_by_id = successor.record.id
    await session.commit()
    return user, successor


async def revoke(session: AsyncSession, raw: str, *, now: datetime | None = None) -> None:
    """Sign out: revoke the token's whole family. Unknown tokens are ignored."""
    current = await session.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw))
    )
    if current is not None:
        await _revoke_family(session, current.family_id, now or datetime.now(UTC))
        await session.commit()


async def revoke_all_for_user(
    session: AsyncSession, user_id: UUID, *, now: datetime | None = None
) -> None:
    """Sign out everywhere, e.g. after a password change."""
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now or datetime.now(UTC))
    )
    await session.commit()
