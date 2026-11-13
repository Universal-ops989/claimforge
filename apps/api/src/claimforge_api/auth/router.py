"""Sign-in, token refresh and sign-out."""

from typing import Annotated

from fastapi import APIRouter, Header, Response, status

from claimforge_api.api.deps import DbSession, SettingsDep
from claimforge_api.api.problems import PROBLEM_RESPONSES
from claimforge_api.auth import refresh_tokens
from claimforge_api.auth.schemas import LoginRequest, RefreshRequest, TokenResponse
from claimforge_api.core.settings import Settings
from claimforge_api.core.tokens import create_access_token
from claimforge_api.users import service as users

router = APIRouter(prefix="/auth", tags=["auth"], responses=PROBLEM_RESPONSES)

UserAgent = Annotated[str | None, Header(include_in_schema=False)]


def _token_response(
    response: Response, settings: Settings, issued: refresh_tokens.IssuedRefreshToken
) -> TokenResponse:
    # Token responses must never be cached (RFC 6749 section 5.1).
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    access = create_access_token(issued.record.user_id, settings)
    return TokenResponse(
        access_token=access.token,
        expires_in=access.expires_in,
        refresh_token=issued.token,
        refresh_expires_at=issued.record.expires_at,
    )


@router.post("/login", summary="Sign in with email and password")
async def login(
    body: LoginRequest,
    session: DbSession,
    settings: SettingsDep,
    response: Response,
    user_agent: UserAgent = None,
) -> TokenResponse:
    user = await users.authenticate(session, body.email, body.password)
    issued = await refresh_tokens.issue(session, user.id, settings, user_agent=user_agent)
    await session.commit()
    return _token_response(response, settings, issued)


@router.post("/refresh", summary="Exchange a refresh token for a new token pair")
async def refresh(
    body: RefreshRequest,
    session: DbSession,
    settings: SettingsDep,
    response: Response,
    user_agent: UserAgent = None,
) -> TokenResponse:
    _user, issued = await refresh_tokens.rotate(
        session, body.refresh_token, settings, user_agent=user_agent
    )
    return _token_response(response, settings, issued)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Sign out of this session")
async def logout(body: RefreshRequest, session: DbSession) -> None:
    await refresh_tokens.revoke(session, body.refresh_token)
