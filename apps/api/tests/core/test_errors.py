"""Domain errors and the extra context they carry into problem responses."""

import pytest

from claimforge_api.core.errors import RESERVED_PROBLEM_MEMBERS, ConflictError, NotFoundError


def test_extras_are_kept() -> None:
    error = NotFoundError("Claim not found", claim_id="abc")

    assert (error.detail, error.extra) == ("Claim not found", {"claim_id": "abc"})


@pytest.mark.parametrize("member", sorted(RESERVED_PROBLEM_MEMBERS))
def test_extras_cannot_shadow_problem_members(member: str) -> None:
    # "status" used to crash only when rendered; "type" or "request_id" were silently replaced.
    with pytest.raises(TypeError, match=member):
        ConflictError("Nope", **{member: "x"})
