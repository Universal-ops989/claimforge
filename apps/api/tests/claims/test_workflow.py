"""The claim status rules on their own, without a database."""

import itertools

import pytest

from claimforge_api.auth.permissions import Permission
from claimforge_api.claims import workflow
from claimforge_api.claims.models import ClaimStatus as S


def test_every_status_has_a_way_out() -> None:
    assert set(workflow.TRANSITIONS) == set(S)
    assert all(workflow.TRANSITIONS[s] for s in S)


def test_no_status_moves_to_itself() -> None:
    assert all(s not in workflow.TRANSITIONS[s] for s in S)


def test_every_status_is_reachable_from_new() -> None:
    seen, frontier = {S.NEW}, [S.NEW]
    while frontier:
        for target in workflow.TRANSITIONS[frontier.pop()] - seen:
            seen.add(target)
            frontier.append(target)
    assert seen == set(S)


def test_the_usual_path_works_end_to_end() -> None:
    path = [S.NEW, S.INSPECTED, S.IN_PROGRESS, S.COMPLETED, S.CLOSED]
    assert all(workflow.is_allowed(a, b) for a, b in itertools.pairwise(path))


@pytest.mark.parametrize(
    ("current", "target"),
    [
        (S.NEW, S.COMPLETED),  # no skipping the work
        (S.NEW, S.CLOSED),
        (S.IN_PROGRESS, S.CLOSED),  # completed first
        (S.CLOSED, S.NEW),  # reopening resumes work, it does not start over
        (S.CANCELLED, S.IN_PROGRESS),  # reinstating starts over
        (S.COMPLETED, S.CANCELLED),  # the work was done
    ],
)
def test_forbidden_moves(current: S, target: S) -> None:
    assert not workflow.is_allowed(current, target)


def test_next_statuses_follow_the_lifecycle_order() -> None:
    assert workflow.next_statuses("new") == [S.INSPECTED, S.IN_PROGRESS, S.ON_HOLD, S.CANCELLED]
    assert workflow.next_statuses(S.CLOSED) == [S.IN_PROGRESS]


@pytest.mark.parametrize(
    ("current", "target", "needed"),
    [
        (S.NEW, S.INSPECTED, False),
        (S.IN_PROGRESS, S.COMPLETED, False),
        (S.COMPLETED, S.CLOSED, False),
        (S.IN_PROGRESS, S.ON_HOLD, True),
        (S.NEW, S.CANCELLED, True),
        (S.CLOSED, S.IN_PROGRESS, True),  # reopen
        (S.CANCELLED, S.NEW, True),  # reinstate
        (S.ON_HOLD, S.IN_PROGRESS, False),  # resuming needs no explanation
    ],
)
def test_reasons(current: S, target: S, needed: bool) -> None:
    assert workflow.needs_reason(current, target) is needed


def test_leaving_a_final_status_needs_the_reopen_permission() -> None:
    assert {s for s in S if workflow.required_permission(s) is Permission.CLAIMS_REOPEN} == {
        S.CLOSED,
        S.CANCELLED,
    }
    assert workflow.required_permission(S.COMPLETED) is Permission.CLAIMS_WRITE
