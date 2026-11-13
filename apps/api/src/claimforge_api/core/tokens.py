"""Short-lived JWT access tokens.

Access tokens are stateless and expire quickly (minutes); long-lived sessions use rotating
refresh tokens stored in the database. Every claim that matters is verified: signature,
algorithm (never ``none``), expiry, issuer, audience and token type.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt

from claimforge_api.core.errors import AuthenticationRequiredError
from claimforge_api.core.ids import uuid7
from claimforge_api.core.settings import Settings

ALGORITHM = "HS256"
ISSUER = "claimforge"
AUDIENCE = "claimforge-api"
ACCESS = "access"
#: Tolerated clock difference between servers.
LEEWAY = timedelta(seconds=10)


class InvalidTokenError(AuthenticationRequiredError):
    code = "invalid_token"
    title = "Invalid access token"


class TokenExpiredError(AuthenticationRequiredError):
    code = "token_expired"
    title = "Access token expired"


@dataclass(frozen=True)
class AccessToken:
    token: str
    expires_at: datetime
    expires_in: int  # seconds


@dataclass(frozen=True)
class AccessClaims:
    user_id: UUID
    token_id: UUID
    issued_at: datetime
    expires_at: datetime


def create_access_token(
    user_id: UUID, settings: Settings, *, now: datetime | None = None
) -> AccessToken:
    issued_at = now or datetime.now(UTC)
    lifetime = timedelta(minutes=settings.access_token_ttl_minutes)
    expires_at = issued_at + lifetime
    payload = {
        "sub": str(user_id),
        "jti": str(uuid7()),
        "iat": issued_at,
        "nbf": issued_at,
        "exp": expires_at,
        "iss": ISSUER,
        "aud": AUDIENCE,
        "typ": ACCESS,
    }
    token = jwt.encode(payload, settings.jwt_secret.get_secret_value(), algorithm=ALGORITHM)
    return AccessToken(token=token, expires_at=expires_at, expires_in=int(lifetime.total_seconds()))


def decode_access_token(token: str, settings: Settings) -> AccessClaims:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret.get_secret_value(),
            algorithms=[ALGORITHM],  # pinned: rejects alg=none and algorithm confusion
            audience=AUDIENCE,
            issuer=ISSUER,
            leeway=LEEWAY,
            options={"require": ["sub", "jti", "iat", "exp", "iss", "aud", "typ"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise TokenExpiredError("The access token has expired; refresh it") from exc
    except jwt.PyJWTError as exc:
        raise InvalidTokenError() from exc

    if payload.get("typ") != ACCESS:
        raise InvalidTokenError("Not an access token")
    try:
        return AccessClaims(
            user_id=UUID(str(payload["sub"])),
            token_id=UUID(str(payload["jti"])),
            issued_at=datetime.fromtimestamp(int(payload["iat"]), tz=UTC),
            expires_at=datetime.fromtimestamp(int(payload["exp"]), tz=UTC),
        )
    except (TypeError, ValueError) as exc:
        raise InvalidTokenError() from exc
