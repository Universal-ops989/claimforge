"""Timeline summaries: how each kind of event reads."""

from typing import Any
from uuid import UUID

import pytest

from claimforge_api.timeline.summaries import Event, Names, summarize, user_ids, visible_changes

AVERY = UUID("0192f3a4-5b6c-7d8e-9f01-000000000001")
DANA = UUID("0192f3a4-5b6c-7d8e-9f01-000000000002")
NAMES = Names(users={AVERY: "Avery Adjuster"}, contacts={DANA: "Dana Whitfield"})


def created(**values: Any) -> dict[str, list[Any]]:
    return {k: [None, v] for k, v in values.items()}


def deleted(**values: Any) -> dict[str, list[Any]]:
    return {k: [v, None] for k, v in values.items()}


@pytest.mark.parametrize(
    ("event", "summary"),
    [
        (Event("claim", "created", created(number="2026-00042")), "Opened claim 2026-00042"),
        (
            Event("claim", "updated", {"loss_date": [None, "2026-11-10"], "status": ["a", "b"]}),
            "Edited the claim: loss date",
        ),
        (Event("claim", "deleted", {"deleted_at": [None, "x"]}), "Deleted the claim"),
        (
            Event(
                "claim_status_change",
                "created",
                created(from_status="new", to_status="on_hold", reason="Waiting on PA"),
            ),
            "Changed the status from new to on hold: Waiting on PA",
        ),
        (
            Event(
                "claim_status_change", "created", created(from_status="new", to_status="inspected")
            ),
            "Changed the status from new to inspected",
        ),
        (
            Event("claim_contact", "created", created(contact_id=str(DANA), role="insured")),
            "Added Dana Whitfield as insured",
        ),
        (
            Event(
                "claim_contact",
                "updated",
                {"is_primary": [False, True]},
                facts={"contact_id": str(DANA), "role": "tenant"},
            ),
            "Made Dana Whitfield the primary contact",
        ),
        (
            Event(
                "claim_contact",
                "updated",
                {"role": ["insured", "co_insured"]},
                facts={"contact_id": str(DANA)},
            ),
            "Changed Dana Whitfield's role to co insured",
        ),
        (
            Event("claim_contact", "deleted", deleted(contact_id=str(DANA), role="insured")),
            "Removed Dana Whitfield from the claim",
        ),
        (
            Event("claim_assignment", "created", created(user_id=str(AVERY), role="adjuster")),
            "Assigned Avery Adjuster as adjuster",
        ),
        (
            Event("claim_assignment", "deleted", deleted(user_id=str(AVERY), role="adjuster")),
            "Unassigned Avery Adjuster as adjuster",
        ),
        (Event("structure", "created", created(name="Garage")), "Added structure Garage"),
        (
            Event("room", "updated", {"name": ["Den", "Office"]}, facts={"name": "Den"}),
            "Renamed room Den to Office",
        ),
        (
            Event("room", "updated", {"structure_id": ["a", "b"]}, facts={"name": "Office"}),
            "Moved room Office to another structure",
        ),
        (
            Event("room", "updated", {"length_ft": ["10.00", "12.00"]}, facts={"name": "Den"}),
            "Updated room Den: length ft",
        ),
        (Event("room", "deleted", deleted(name="Den")), "Deleted room Den"),
        (
            Event("damage_item", "created", created(material="Drywall", cause="water")),
            "Recorded Drywall damage (water)",
        ),
        (
            Event("damage_item", "updated", {"water_class": [2, 3]}, facts={"material": "Drywall"}),
            "Updated Drywall damage: water class",
        ),
        (
            Event("note", "created", created(body=f"<@{AVERY}> call the carrier")),
            "Wrote a note: @Avery Adjuster call the carrier",
        ),
        (
            Event("task", "created", created(title="Set dehus", assignee_id=str(AVERY))),
            "Added task “Set dehus” for Avery Adjuster",
        ),
        (
            Event(
                "task",
                "updated",
                {
                    "completed_at": [None, "2026-11-15T10:00:00+00:00"],
                    "completed_by_id": [None, "x"],
                },
                facts={"title": "Set dehus"},
            ),
            "Completed task “Set dehus”",
        ),
        (
            Event("task", "updated", {"completed_at": ["x", None]}, facts={"title": "Set dehus"}),
            "Reopened task “Set dehus”",
        ),
        (
            Event("task", "updated", {"assignee_id": [str(AVERY), None]}, facts={"title": "T"}),
            "Unassigned task “T”",
        ),
        (
            Event("task", "updated", {"due_on": [None, "2026-11-20"]}, facts={"title": "T"}),
            "Updated task “T”: due on",
        ),
        (Event("widget", "created", {}), "Created widget"),
    ],
)
def test_summaries(event: Event, summary: str) -> None:
    assert summarize(event, NAMES) == summary


def test_people_who_are_gone_still_read_well() -> None:
    event = Event("claim_assignment", "created", created(user_id=str(DANA), role="contractor"))

    assert summarize(event, Names()) == "Assigned a former member as contractor"


def test_long_notes_are_cut_short() -> None:
    summary = summarize(Event("note", "created", created(body="word " * 40)), NAMES)

    assert summary.endswith("…")
    assert len(summary.removeprefix("Wrote a note: ")) == 80


def test_names_to_look_up() -> None:
    note = Event("note", "updated", {"body": ["x", f"<@{AVERY}>"]})
    task = Event(
        "task", "updated", {"due_on": [None, "2026-11-20"]}, facts={"assignee_id": str(DANA)}
    )

    assert user_ids(note) == {AVERY}
    assert user_ids(task) == {DANA}


def test_readers_see_what_changed_not_the_plumbing() -> None:
    claim = Event("claim", "updated", {"status": ["new", "x"], "description": [None, "d"]})
    room = Event("room", "created", created(organization_id="o", claim_id="c", name="Den"))

    assert visible_changes(claim) == {"description": [None, "d"]}
    assert visible_changes(room) == {"name": [None, "Den"]}
