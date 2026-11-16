"""One-line English summaries of claim events, for the timeline.

Pure functions over what the audit log recorded, so every phrasing is unit-tested without
a database. Names (members, contacts) are looked up by the caller and passed in.
"""

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import UUID

from claimforge_api.equipment.models import equipment_days
from claimforge_api.notes import mentions

EXCERPT = 80
#: Columns that say where a record sits rather than what it is.
_PLUMBING = frozenset({"organization_id", "claim_id"})
_TITLE = frozenset({"title"})
_READINGS_EDITED = frozenset({"readings_edited_at"})


@dataclass(frozen=True)
class Names:
    users: Mapping[UUID, str] = field(default_factory=dict)
    contacts: Mapping[UUID, str] = field(default_factory=dict)

    def user(self, value: object) -> str:
        return self.users.get(_uuid(value), "a former member") if value else "nobody"

    def contact(self, value: object) -> str:
        return self.contacts.get(_uuid(value), "a contact") if value else "a contact"


@dataclass(frozen=True)
class Event:
    """One audit event, plus the values its record was created with."""

    entity_type: str
    verb: str  # created, updated, deleted or restored
    changes: Mapping[str, list[Any]]
    # The record's values when created (from its created event), for names an update or
    # delete doesn't repeat.
    facts: Mapping[str, Any] = field(default_factory=dict)

    def value(self, key: str) -> Any:
        """The field's latest value as of this event."""
        if key in self.changes:
            before, after = self.changes[key]
            return after if after is not None else before
        return self.facts.get(key)

    def changed(self, key: str) -> bool:
        return key in self.changes and self.verb == "updated"

    def became(self, key: str) -> tuple[Any, Any]:
        before, after = self.changes[key]
        return before, after


def _uuid(value: object) -> UUID:
    return value if isinstance(value, UUID) else UUID(str(value))


def label(value: object) -> str:
    """``on_hold`` -> ``on hold``."""
    return str(value).replace("_", " ")


def _fields(event: Event, *, skip: frozenset[str] = frozenset()) -> str:
    keys = [k for k in event.changes if k not in skip and k not in _PLUMBING]
    return ", ".join(label(k) for k in keys)


def _with_fields(text: str, event: Event, *, skip: frozenset[str] = frozenset()) -> str:
    changed = _fields(event, skip=skip)
    return f"{text}: {changed}" if changed else text


def _excerpt(body: str, names: Names) -> str:
    text = mentions.render(body, names.users)
    flat = " ".join(text.split())
    return flat if len(flat) <= EXCERPT else flat[: EXCERPT - 1].rstrip() + "…"


def _claim(event: Event, names: Names) -> str:
    return {
        "created": f"Opened claim {event.value('number')}",
        "deleted": "Deleted the claim",
        "restored": "Restored the claim",
    }.get(event.verb) or _with_fields("Edited the claim", event, skip=frozenset({"status"}))


def _status(event: Event, names: Names) -> str:
    text = (
        f"Changed the status from {label(event.value('from_status'))} "
        f"to {label(event.value('to_status'))}"
    )
    reason = event.value("reason")
    return f"{text}: {reason}" if reason else text


def _contact(event: Event, names: Names) -> str:
    who = names.contact(event.value("contact_id"))
    role = label(event.value("role"))
    if event.verb == "created":
        return f"Added {who} as {role}"
    if event.verb == "deleted":
        return f"Removed {who} from the claim"
    if event.changed("is_primary") and event.became("is_primary")[1]:
        return f"Made {who} the primary contact"
    if event.changed("role"):
        return f"Changed {who}'s role to {role}"
    return f"Updated {who} on the claim"


def _assignment(event: Event, names: Names) -> str:
    who = names.user(event.value("user_id"))
    role = label(event.value("role"))
    if event.verb == "deleted":
        return f"Unassigned {who} as {role}"
    return f"Assigned {who} as {role}"


def _named(kind: str) -> Callable[[Event, Names], str]:
    def summarize(event: Event, names: Names) -> str:
        name = event.value("name")
        if event.verb == "created":
            return f"Added {kind} {name}"
        if event.verb == "deleted":
            return f"Deleted {kind} {name}"
        if event.changed("name"):
            before, after = event.became("name")
            return f"Renamed {kind} {before} to {after}"
        if event.changed("structure_id"):
            return f"Moved {kind} {name} to another structure"
        return _with_fields(f"Updated {kind} {name}", event)

    return summarize


def _damage(event: Event, names: Names) -> str:
    what = f"{event.value('material')} damage"
    if event.verb == "created":
        return f"Recorded {what} ({label(event.value('cause'))})"
    if event.verb == "deleted":
        return f"Removed {what}"
    if event.changed("room_id"):
        return f"Moved {what} to another room"
    return _with_fields(f"Updated {what}", event)


def _photo(event: Event, names: Names) -> str:
    name = event.value("original_filename")
    if event.verb == "created":
        return f"Added photo {name}"
    if event.verb == "deleted":
        return f"Deleted photo {name}"
    if event.changed("room_id"):
        before, after = event.became("room_id")
        if before is None:
            return f"Put photo {name} in a room"
        if after is None:
            return f"Took photo {name} out of its room"
        return f"Moved photo {name} to another room"
    return _with_fields(f"Updated photo {name}", event)


def _document(event: Event, names: Names) -> str:
    title = f"“{event.value('title')}”"
    if event.verb == "created":
        category = event.value("category")
        kind = "document" if category in (None, "other") else label(category)
        return f"Attached {kind} {title}"
    if event.verb == "deleted":
        return f"Deleted document {title}"
    if event.changed("title"):
        before, after = event.became("title")
        return _with_fields(f"Renamed document “{before}” to “{after}”", event, skip=_TITLE)
    if event.changed("category"):
        return f"Recategorized document {title} as {label(event.value('category'))}"
    return _with_fields(f"Updated document {title}", event)


def _moisture_point(event: Event, names: Names) -> str:
    point = f"moisture point {event.value('label')}"
    if event.verb == "created":
        return f"Mapped {point} ({event.value('material')}, {event.value('surface')})"
    if event.verb == "deleted":
        return f"Deleted {point}"
    if event.changed("label"):
        before, after = event.became("label")
        return f"Relabeled moisture point {before} as {after}"
    if event.changed("room_id"):
        return f"Moved {point} to another room"
    if event.changed("dry_standard"):
        _, goal = event.became("dry_standard")
        if goal is None:
            return f"Cleared the dry standard of {point}"
        basis = label(event.value("dry_standard_basis"))
        return f"Set the dry standard of {point} to {goal} ({basis})"
    return _with_fields(f"Updated {point}", event)


def _moisture_log(event: Event, names: Names) -> str:
    if event.verb == "created":
        return "Logged moisture readings"
    if event.verb == "deleted":
        return "Deleted moisture readings"
    if event.changed("readings_edited_at"):
        return _with_fields("Corrected moisture readings", event, skip=_READINGS_EDITED)
    return _with_fields("Updated moisture readings", event)


def _placement(event: Event, names: Names) -> str:
    unit = f"{label(event.value('kind'))} {event.value('asset_tag')}"
    if event.verb == "created":
        return f"Placed {unit}"
    if event.verb == "deleted":
        return f"Deleted the placement of {unit}"
    if event.changed("removed_at"):
        _, removed_at = event.became("removed_at")
        if removed_at is None:
            return f"Put {unit} back to running"
        placed_at = datetime.fromisoformat(str(event.value("placed_at")))
        days = equipment_days(placed_at, datetime.fromisoformat(str(removed_at)))
        return f"Removed {unit} after {days} day{'s' if days != 1 else ''}"
    if event.changed("room_id"):
        return f"Moved {unit} to another room"
    return _with_fields(f"Corrected the placement of {unit}", event)


#: How each estimate status change reads, by (from, to).
_ESTIMATE_MOVES = {
    ("draft", "submitted"): "Submitted",
    ("submitted", "approved"): "Approved",
    ("submitted", "rejected"): "Rejected",
    ("submitted", "draft"): "Withdrew",
}


def _estimate(event: Event, names: Names) -> str:
    estimate = f"estimate {event.value('number')}"
    if event.verb == "created":
        return f"Started {estimate}: {event.value('title')}"
    if event.verb == "deleted":
        return f"Deleted draft {estimate}"
    if event.changed("status"):
        before, after = event.became("status")
        verb = _ESTIMATE_MOVES.get((before, after), "Reopened")
        return f"{verb} {estimate}"
    return _with_fields(f"Updated {estimate}", event)


def _report(event: Event, names: Names) -> str:
    report = label(event.value("kind"))  # "photo report"
    if event.verb == "created":
        return f"Requested a {report}"
    if event.verb == "deleted":
        return f"Deleted a {report}"
    if event.changed("status"):
        _, status = event.became("status")
        if status == "ready":
            return f"Generated the {report}"
        if status == "failed":
            return f"The {report} couldn't be made"
    return f"Retrying the {report}"


def _note(event: Event, names: Names) -> str:
    verb = {"created": "Wrote", "updated": "Edited", "deleted": "Deleted"}.get(
        event.verb, "Changed"
    )
    return f"{verb} a note: {_excerpt(str(event.value('body')), names)}"


def _task(event: Event, names: Names) -> str:
    title = f"“{event.value('title')}”"
    if event.verb == "created":
        assignee = event.value("assignee_id")
        suffix = f" for {names.user(assignee)}" if assignee else ""
        return f"Added task {title}{suffix}"
    if event.verb == "deleted":
        return f"Deleted task {title}"
    if event.changed("completed_at"):
        return (
            f"Completed task {title}"
            if event.became("completed_at")[1]
            else f"Reopened task {title}"
        )
    if event.changed("assignee_id"):
        assignee = event.became("assignee_id")[1]
        if assignee is None:
            return f"Unassigned task {title}"
        return f"Assigned task {title} to {names.user(assignee)}"
    return _with_fields(f"Updated task {title}", event, skip=frozenset({"completed_by_id"}))


SUMMARIES: dict[str, Callable[[Event, Names], str]] = {
    "claim": _claim,
    "claim_status_change": _status,
    "claim_contact": _contact,
    "claim_assignment": _assignment,
    "structure": _named("structure"),
    "room": _named("room"),
    "damage_item": _damage,
    "photo": _photo,
    "document": _document,
    "moisture_point": _moisture_point,
    "moisture_log": _moisture_log,
    "equipment_placement": _placement,
    "estimate": _estimate,
    "report_job": _report,
    "note": _note,
    "task": _task,
}


def summarize(event: Event, names: Names) -> str:
    summary = SUMMARIES.get(event.entity_type)
    if summary is None:
        return f"{event.verb.capitalize()} {label(event.entity_type)}"
    return summary(event, names)


def user_ids(event: Event) -> set[UUID]:
    """Members a summary of ``event`` names, so the caller can look them up in one go."""
    found: set[UUID] = set()
    for key in ("user_id", "assignee_id"):
        if key in event.changes:
            found.update(_uuid(v) for v in event.changes[key] if v)
        elif event.facts.get(key):
            found.add(_uuid(event.facts[key]))
    body = event.value("body")
    if event.entity_type == "note" and body:
        found.update(mentions.mentioned_ids(str(body)))
    return found


def contact_ids(event: Event) -> set[UUID]:
    value = event.value("contact_id")
    return {_uuid(value)} if value else set()


def visible_changes(event: Event) -> dict[str, list[Any]]:
    """The changes a reader needs: no plumbing ids, and no claim status (its own event)."""
    skip = _PLUMBING | ({"status"} if event.entity_type == "claim" else set())
    return {k: v for k, v in event.changes.items() if k not in skip}
