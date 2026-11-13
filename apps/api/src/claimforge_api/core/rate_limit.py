"""Token-bucket rate limiting.

Each key (e.g. ``login:ip:203.0.113.7``) has a bucket holding up to ``capacity`` tokens that
refills continuously at ``capacity / period`` tokens per second. A request spends one token;
an empty bucket means "slow down", with the exact wait reported for ``Retry-After``.

The in-memory implementation suits a single API instance. Behind several instances, swap in
a shared store (e.g. Redis) implementing the same ``RateLimiter`` protocol.
"""

import math
import time
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass
from typing import Protocol

from claimforge_api.core.errors import AppError


class RateLimitedError(AppError):
    status = 429
    code = "rate_limited"
    title = "Too many requests"


@dataclass(frozen=True)
class Limit:
    """``capacity`` requests per ``period_seconds``, refilled smoothly."""

    capacity: int
    period_seconds: float

    @property
    def refill_per_second(self) -> float:
        return self.capacity / self.period_seconds


@dataclass(frozen=True)
class Decision:
    allowed: bool
    retry_after_seconds: int = 0


class RateLimiter(Protocol):
    def hit(self, key: str, limit: Limit) -> Decision: ...


class InMemoryRateLimiter:
    """Token buckets in a bounded LRU map (old keys are evicted, so memory stays flat)."""

    def __init__(self, *, max_keys: int = 10_000, clock: Callable[[], float] = time.monotonic):
        self._buckets: OrderedDict[str, tuple[float, float]] = OrderedDict()  # tokens, updated
        self._max_keys = max_keys
        self._clock = clock

    def hit(self, key: str, limit: Limit) -> Decision:
        now = self._clock()
        tokens, updated = self._buckets.pop(key, (float(limit.capacity), now))
        tokens = min(limit.capacity, tokens + (now - updated) * limit.refill_per_second)

        if tokens >= 1:
            decision = Decision(allowed=True)
            tokens -= 1
        else:
            wait = (1 - tokens) / limit.refill_per_second
            decision = Decision(allowed=False, retry_after_seconds=max(1, math.ceil(wait)))

        self._buckets[key] = (tokens, now)
        while len(self._buckets) > self._max_keys:
            self._buckets.popitem(last=False)
        return decision


def enforce(limiter: RateLimiter, key: str, limit: Limit) -> None:
    """Raise ``RateLimitedError`` (429 with Retry-After) when ``key`` is over ``limit``."""
    decision = limiter.hit(key, limit)
    if not decision.allowed:
        error = RateLimitedError(
            f"Too many attempts. Try again in {decision.retry_after_seconds} seconds.",
            retry_after_seconds=decision.retry_after_seconds,
        )
        error.headers = {"Retry-After": str(decision.retry_after_seconds)}
        raise error
