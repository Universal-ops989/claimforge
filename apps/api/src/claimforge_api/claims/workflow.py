"""The claim status workflow: which status changes are allowed, and what each one needs.

Kept free of database access so the rules can be read, tested and shown to clients
(``ClaimRead.next_statuses``) on their own.
"""

from claimforge_api.auth.permissions import Permission
from claimforge_api.claims.models import ClaimStatus

S = ClaimStatus

TRANSITIONS: dict[ClaimStatus, frozenset[ClaimStatus]] = {
    S.NEW: frozenset({S.INSPECTED, S.IN_PROGRESS, S.ON_HOLD, S.CANCELLED}),
    S.INSPECTED: frozenset({S.IN_PROGRESS, S.ON_HOLD, S.CANCELLED}),
    S.IN_PROGRESS: frozenset({S.ON_HOLD, S.COMPLETED, S.CANCELLED}),
    # Resume where it makes sense, or give up.
    S.ON_HOLD: frozenset({S.NEW, S.INSPECTED, S.IN_PROGRESS, S.CANCELLED}),
    # More work turned up after completion, or the file is done.
    S.COMPLETED: frozenset({S.IN_PROGRESS, S.CLOSED}),
    S.CLOSED: frozenset({S.IN_PROGRESS}),  # reopen
    S.CANCELLED: frozenset({S.NEW}),  # reinstate
}

#: Closed and cancelled claims are read-only until reopened or reinstated.
FINAL = frozenset({S.CLOSED, S.CANCELLED})

#: Changes someone will later ask "why?" about.
_REASON_REQUIRED_INTO = frozenset({S.ON_HOLD, S.CANCELLED})


def next_statuses(current: ClaimStatus | str) -> list[ClaimStatus]:
    """Statuses reachable from ``current``, in lifecycle order."""
    allowed = TRANSITIONS[ClaimStatus(current)]
    return [status for status in ClaimStatus if status in allowed]


def is_allowed(current: ClaimStatus | str, target: ClaimStatus) -> bool:
    return target in TRANSITIONS[ClaimStatus(current)]


def needs_reason(current: ClaimStatus | str, target: ClaimStatus) -> bool:
    return target in _REASON_REQUIRED_INTO or ClaimStatus(current) in FINAL


def required_permission(current: ClaimStatus | str) -> Permission:
    """Leaving a final status (reopening, reinstating) is a supervisor's call."""
    return Permission.CLAIMS_REOPEN if ClaimStatus(current) in FINAL else Permission.CLAIMS_WRITE
