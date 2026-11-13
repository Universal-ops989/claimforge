"""UUID version 7 (RFC 9562): time-ordered identifiers.

Layout (128 bits): 48-bit Unix timestamp in milliseconds, 4-bit version (7), 12-bit
counter, 2-bit variant (0b10), 62 random bits. Sorting by id sorts by creation time,
which keeps B-tree indexes compact compared with random UUIDv4 keys.

Within the same millisecond a 12-bit counter keeps ids strictly increasing from this
process. Python 3.14 adds ``uuid.uuid7``; this module can be dropped when we move to it.
"""

import os
import threading
import time
from datetime import UTC, datetime
from uuid import UUID

_lock = threading.Lock()
_last_ms = -1
_counter = 0
_COUNTER_MAX = 0xFFF


def uuid7() -> UUID:
    """A new UUIDv7, strictly increasing within this process."""
    global _last_ms, _counter

    with _lock:
        now_ms = time.time_ns() // 1_000_000
        if now_ms > _last_ms:
            _last_ms = now_ms
            _counter = int.from_bytes(os.urandom(2), "big") & 0x3FF  # random start, leaves headroom
        else:
            # Same (or earlier, after a clock step back) millisecond: bump the counter.
            _counter += 1
            if _counter > _COUNTER_MAX:
                # Counter exhausted: borrow the next millisecond to stay monotonic.
                _last_ms += 1
                _counter = 0
        timestamp_ms = _last_ms
        counter = _counter

    random_bits = int.from_bytes(os.urandom(8), "big") & ((1 << 62) - 1)
    value = (
        (timestamp_ms & ((1 << 48) - 1)) << 80
        | 0x7 << 76
        | counter << 64
        | 0b10 << 62
        | random_bits
    )
    return UUID(int=value)


def uuid7_timestamp(value: UUID) -> datetime:
    """Creation time embedded in a UUIDv7 (millisecond precision, UTC)."""
    if value.version != 7:
        raise ValueError(f"Not a UUIDv7: {value}")
    return datetime.fromtimestamp((value.int >> 80) / 1000, tz=UTC)
