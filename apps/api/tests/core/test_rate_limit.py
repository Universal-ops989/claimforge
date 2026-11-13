import pytest

from claimforge_api.core.rate_limit import InMemoryRateLimiter, Limit, RateLimitedError, enforce

FIVE_PER_MINUTE = Limit(capacity=5, period_seconds=60)


class FakeClock:
    def __init__(self) -> None:
        self.now = 1_000.0

    def __call__(self) -> float:
        return self.now


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def limiter(clock: FakeClock) -> InMemoryRateLimiter:
    return InMemoryRateLimiter(clock=clock)


def test_allows_a_burst_up_to_capacity(limiter: InMemoryRateLimiter) -> None:
    decisions = [limiter.hit("k", FIVE_PER_MINUTE).allowed for _ in range(6)]

    assert decisions == [True, True, True, True, True, False]


def test_reports_how_long_to_wait(limiter: InMemoryRateLimiter) -> None:
    for _ in range(5):
        limiter.hit("k", FIVE_PER_MINUTE)

    decision = limiter.hit("k", FIVE_PER_MINUTE)

    assert not decision.allowed
    assert decision.retry_after_seconds == 12  # one token per 12 seconds


def test_refills_smoothly(limiter: InMemoryRateLimiter, clock: FakeClock) -> None:
    for _ in range(5):
        limiter.hit("k", FIVE_PER_MINUTE)

    clock.now += 12
    assert limiter.hit("k", FIVE_PER_MINUTE).allowed
    assert not limiter.hit("k", FIVE_PER_MINUTE).allowed


def test_refill_never_exceeds_capacity(limiter: InMemoryRateLimiter, clock: FakeClock) -> None:
    clock.now += 3_600

    decisions = [limiter.hit("k", FIVE_PER_MINUTE).allowed for _ in range(6)]

    assert decisions.count(True) == 5


def test_keys_are_independent(limiter: InMemoryRateLimiter) -> None:
    for _ in range(5):
        limiter.hit("a", FIVE_PER_MINUTE)

    assert not limiter.hit("a", FIVE_PER_MINUTE).allowed
    assert limiter.hit("b", FIVE_PER_MINUTE).allowed


def test_memory_is_bounded(clock: FakeClock) -> None:
    limiter = InMemoryRateLimiter(max_keys=3, clock=clock)
    for key in "abcde":
        limiter.hit(key, FIVE_PER_MINUTE)

    assert len(limiter._buckets) == 3


def test_enforce_raises_with_retry_after(limiter: InMemoryRateLimiter) -> None:
    for _ in range(5):
        enforce(limiter, "k", FIVE_PER_MINUTE)

    with pytest.raises(RateLimitedError) as caught:
        enforce(limiter, "k", FIVE_PER_MINUTE)
    assert caught.value.headers == {"Retry-After": "12"}
    assert caught.value.extra == {"retry_after_seconds": 12}
