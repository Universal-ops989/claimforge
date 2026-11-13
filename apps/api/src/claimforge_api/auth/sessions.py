"""Turning an authenticated user into a token pair."""

from typing import Annotated
from uuid import UUID

from fastapi import Header, Response
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.auth import refresh_tokens
from claimforge_api.auth.schemas import TokenResponse
from claimforge_api.core.settings import Settings
from claimforge_api.core.tokens import create_access_token

UserAgent = Annotated[str | None, Header(include_in_schema=False)]


def token_response(
    response: Response, settings: Settings, issued: refresh_tokens.IssuedRefreshToken
) -> TokenResponse:
    """Access token plus the given refresh token, marked uncacheable (RFC 6749 section 5.1)."""
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    access = create_access_token(issued.record.user_id, settings)
    return TokenResponse(
        access_token=access.token,
        expires_in=access.expires_in,
        refresh_token=issued.token,
        refresh_expires_at=issued.record.expires_at,
    )


async def start_session(
    session: AsyncSession,
    response: Response,
    settings: Settings,
    user_id: UUID,
    *,
    user_agent: str | None,
) -> TokenResponse:
    """Begin a new refresh-token family for the user and return the token pair."""
    issued = await refresh_tokens.issue(session, user_id, settings, user_agent=user_agent)
    await session.commit()
    return token_response(response, settings, issued)
