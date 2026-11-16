"""Whether a moisture point has reached its dry standard, from its readings.

Lower is drier on both scales, so a point is dry when its latest reading is at or below
its goal. ``dried_at`` is when the current run of dry readings began: a point that dipped
below the goal, came back up and dipped again dried at the second dip.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from enum import StrEnum


class DryingStatus(StrEnum):
    DRY = "dry"
    DRYING = "drying"
    NO_GOAL = "no_goal"  # read, but there's nothing to compare with
    NOT_READ = "not_read"


@dataclass(frozen=True)
class Progress:
    status: DryingStatus
    latest: Decimal | None
    dried_at: datetime | None


def progress(readings: Sequence[tuple[datetime, Decimal]], goal: Decimal | None) -> Progress:
    """A point's progress from its readings, oldest first."""
    if not readings:
        return Progress(DryingStatus.NOT_READ, None, None)
    latest = readings[-1][1]
    if goal is None:
        return Progress(DryingStatus.NO_GOAL, latest, None)
    if latest > goal:
        return Progress(DryingStatus.DRYING, latest, None)
    dried_at = readings[-1][0]
    for taken_at, value in reversed(readings):
        if value > goal:
            break
        dried_at = taken_at
    return Progress(DryingStatus.DRY, latest, dried_at)
