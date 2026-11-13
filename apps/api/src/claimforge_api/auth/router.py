"""Sign-in, token refresh and sign-out."""

from fastapi import APIRouter, Depends, Response, status

from claimforge_api.api.deps import DbSession, SettingsDep
from claimforge_api.api.problems import PROBLEM_RESPONSES, RATE_LIMITED_RESPONSE
from claimforge_api.auth import refresh_tokens
from claimforge_api.auth.limits import (
    LOGIN_PER_IP,
    REFRESH_PER_IP,
    LimiterDep,
    limit_by_ip,
    limit_login_attempts_for,
)
from claimforge_api.auth.schemas import LoginRequest, RefreshRequest, TokenResponse
from claimforge_api.auth.sessions import UserAgent, start_session, token_response
from claimforge_api.users import service as users

router = APIRouter(prefix="/auth", tags=["auth"], responses=PROBLEM_RESPONSES)


@router.post(
    "/login",
    summary="Sign in with email and password",
    dependencies=[Depends(limit_by_ip("login", LOGIN_PER_IP))],
    responses=RATE_LIMITED_RESPONSE,
)
async def login(
    body: LoginRequest,
    session: DbSession,
    settings: SettingsDep,
    limiter: LimiterDep,
    response: Response,
    user_agent: UserAgent = None,
) -> TokenResponse:
    limit_login_attempts_for(body.email, settings, limiter)
    user = await users.authenticate(session, body.email, body.password)
    return await start_session(session, response, settings, user.id, user_agent=user_agent)


@router.post(
    "/refresh",
    summary="Exchange a refresh token for a new token pair",
    dependencies=[Depends(limit_by_ip("refresh", REFRESH_PER_IP))],
    responses=RATE_LIMITED_RESPONSE,
)
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
    return token_response(response, settings, issued)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Sign out of this session")
async def logout(body: RefreshRequest, session: DbSession) -> None:
    await refresh_tokens.revoke(session, body.refresh_token)
