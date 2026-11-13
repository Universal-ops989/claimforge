import base64
import json
import warnings
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
import pytest
from pydantic import SecretStr, ValidationError

from claimforge_api.core.ids import uuid7
from claimforge_api.core.settings import DEV_JWT_SECRET, Environment, Settings
from claimforge_api.core.tokens import (
    AUDIENCE,
    ISSUER,
    InvalidTokenError,
    TokenExpiredError,
    create_access_token,
    decode_access_token,
)

SECRET = "a-test-secret-that-is-long-enough-1234"


@pytest.fixture
def settings() -> Settings:
    return Settings(_env_file=None, jwt_secret=SecretStr(SECRET), access_token_ttl_minutes=15)


def forge(claims: dict[str, Any], secret: str = SECRET, algorithm: str = "HS256") -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(uuid7()),
        "jti": str(uuid7()),
        "iat": now,
        "nbf": now,
        "exp": now + timedelta(minutes=5),
        "iss": ISSUER,
        "aud": AUDIENCE,
        "typ": "access",
        **claims,
    }
    return jwt.encode(payload, secret, algorithm=algorithm)


def forge_with_hs512() -> str:
    """Same key, different algorithm: must be rejected by the pinned HS256 check."""
    with warnings.catch_warnings():
        # PyJWT warns that our key is short for HS512; irrelevant to this forgery.
        warnings.simplefilter("ignore", jwt.warnings.InsecureKeyLengthWarning)
        return forge({}, algorithm="HS512")


def test_round_trip(settings: Settings) -> None:
    user_id = uuid7()
    issued = create_access_token(user_id, settings)

    claims = decode_access_token(issued.token, settings)

    assert claims.user_id == user_id
    assert issued.expires_in == 900
    assert claims.expires_at == issued.expires_at.replace(microsecond=0)


def test_each_token_has_a_unique_id(settings: Settings) -> None:
    user_id = uuid7()
    first = decode_access_token(create_access_token(user_id, settings).token, settings)
    second = decode_access_token(create_access_token(user_id, settings).token, settings)

    assert first.token_id != second.token_id


def test_expired_tokens_have_their_own_error(settings: Settings) -> None:
    old = datetime.now(UTC) - timedelta(hours=1)
    token = create_access_token(uuid7(), settings, now=old).token

    with pytest.raises(TokenExpiredError):
        decode_access_token(token, settings)


@pytest.mark.parametrize(
    "token_factory",
    [
        pytest.param(lambda: forge({"iss": "someone-else"}), id="wrong issuer"),
        pytest.param(lambda: forge({"aud": "other-api"}), id="wrong audience"),
        pytest.param(lambda: forge({"typ": "refresh"}), id="wrong type"),
        pytest.param(lambda: forge({"sub": "not-a-uuid"}), id="bad subject"),
        pytest.param(
            lambda: forge({"nbf": datetime.now(UTC) + timedelta(hours=1)}), id="not yet valid"
        ),
        pytest.param(lambda: forge({}, secret="another-secret-of-sufficient-length"), id="key"),
        pytest.param(forge_with_hs512, id="other algorithm"),
        pytest.param(lambda: "not.a.jwt", id="garbage"),
    ],
)
def test_rejects_invalid_tokens(settings: Settings, token_factory: Any) -> None:
    with pytest.raises(InvalidTokenError):
        decode_access_token(token_factory(), settings)


def test_rejects_unsigned_alg_none_tokens(settings: Settings) -> None:
    valid = forge({})
    header, payload, _signature = valid.split(".")
    none_header = base64.urlsafe_b64encode(json.dumps({"alg": "none", "typ": "JWT"}).encode())
    unsigned = f"{none_header.decode().rstrip('=')}.{payload}."

    with pytest.raises(InvalidTokenError):
        decode_access_token(unsigned, settings)
    assert header  # the original token was well-formed


def test_rejects_tampered_payloads(settings: Settings) -> None:
    token = create_access_token(uuid7(), settings).token
    header, payload, signature = token.split(".")
    claims = json.loads(base64.urlsafe_b64decode(payload + "=="))
    claims["sub"] = str(uuid7())
    forged = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip("=")

    with pytest.raises(InvalidTokenError):
        decode_access_token(f"{header}.{forged}.{signature}", settings)


@pytest.mark.parametrize("secret", [DEV_JWT_SECRET, "too-short"])
def test_production_requires_a_strong_secret(secret: str) -> None:
    with pytest.raises(ValidationError, match="CLAIMFORGE_JWT_SECRET"):
        Settings(_env_file=None, environment=Environment.PRODUCTION, jwt_secret=SecretStr(secret))


def test_secret_is_never_printed(settings: Settings) -> None:
    assert SECRET not in repr(settings)
    assert SECRET not in str(settings.model_dump())
