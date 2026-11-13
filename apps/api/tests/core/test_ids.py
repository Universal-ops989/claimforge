from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest

from claimforge_api.core.ids import uuid7, uuid7_timestamp


def test_sets_version_and_variant_bits() -> None:
    value = uuid7()

    assert value.version == 7
    assert value.variant == "specified in RFC 4122"  # RFC 9562 keeps the 0b10 variant


def test_is_strictly_increasing_within_a_process() -> None:
    values = [uuid7() for _ in range(20_000)]

    assert values == sorted(values)
    assert len(set(values)) == len(values)


def test_embeds_the_creation_time() -> None:
    before = datetime.now(UTC) - timedelta(milliseconds=5)
    value = uuid7()
    after = datetime.now(UTC) + timedelta(milliseconds=5)

    assert before <= uuid7_timestamp(value) <= after


def test_sorts_by_creation_time_across_milliseconds() -> None:
    first = uuid7()
    later = UUID(int=first.int + (1 << 80))  # same id one millisecond later

    assert first < later
    assert uuid7_timestamp(later) - uuid7_timestamp(first) == timedelta(milliseconds=1)


def test_rejects_other_versions() -> None:
    with pytest.raises(ValueError, match="Not a UUIDv7"):
        uuid7_timestamp(uuid4())
