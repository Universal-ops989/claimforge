"""Rate limits for authentication endpoints."""

from collections.abc import Awaitable, Callable
from typing import Annotated, cast

from fastapi import Depends, Request

from claimforge_api.api.deps import SettingsDep
from claimforge_api.core.rate_limit import Limit, RateLimiter, enforce
from claimforge_api.core.settings import Settings

# Generous enough for people mistyping, tight enough to make guessing impractical.
LOGIN_PER_IP = Limit(capacity=20, period_seconds=60)
LOGIN_PER_EMAIL = Limit(capacity=5, period_seconds=60)
REFRESH_PER_IP = Limit(capacity=60, period_seconds=60)
INVITATION_ACCEPT_PER_IP = Limit(capacity=10, period_seconds=60)


def get_rate_limiter(request: Request) -> RateLimiter:
    return cast("RateLimiter", request.app.state.rate_limiter)


LimiterDep = Annotated[RateLimiter, Depends(get_rate_limiter)]


def client_ip(request: Request) -> str:
    # Behind a load balancer, run uvicorn with --proxy-headers so this is the real client.
    return request.client.host if request.client else "unknown"


def limit_by_ip(scope: str, limit: Limit) -> Callable[..., Awaitable[None]]:
    """Route dependency: ``dependencies=[Depends(limit_by_ip("login", LOGIN_PER_IP))]``."""

    async def dependency(request: Request, settings: SettingsDep, limiter: LimiterDep) -> None:
        if settings.rate_limit_enabled:
            enforce(limiter, f"{scope}:ip:{client_ip(request)}", limit)

    return dependency


def limit_login_attempts_for(email: str, settings: Settings, limiter: RateLimiter) -> None:
    """Per-account limit: slows guessing one password from many IP addresses."""
    if settings.rate_limit_enabled:
        enforce(limiter, f"login:email:{email.strip().lower()}", LOGIN_PER_EMAIL)
