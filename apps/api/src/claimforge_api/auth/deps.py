"""Authentication dependencies for routes."""

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from claimforge_api.api.deps import DbSession, SettingsDep
from claimforge_api.core.errors import AuthenticationRequiredError
from claimforge_api.core.tokens import InvalidTokenError, decode_access_token
from claimforge_api.users.models import User

# auto_error=False: we raise our own problem-details error instead of FastAPI's default.
_bearer = HTTPBearer(auto_error=False, description="Access token from /v1/auth/login")


async def get_current_user(
    session: DbSession,
    settings: SettingsDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    """The signed-in user, from ``Authorization: Bearer <access token>``."""
    if credentials is None:
        raise AuthenticationRequiredError("Sign in to continue")

    claims = decode_access_token(credentials.credentials, settings)
    user = await session.get(User, claims.user_id)
    # Access tokens live for minutes, but deactivation must take effect immediately.
    if user is None or user.is_deleted or not user.is_active:
        raise InvalidTokenError("This account is no longer active")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
