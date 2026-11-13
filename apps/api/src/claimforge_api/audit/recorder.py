"""Records audit events automatically when audited models are flushed.

Models opt in with ``__audited__ = True``. After each flush (when primary keys exist), one
event per inserted, updated or deleted row is written on the same connection, so audit rows
commit or roll back together with the change itself.

Events are named after the table ("contacts" -> "contact.created"); a model whose table
name is not a simple plural sets ``__audit_entity__`` ("properties" -> "property").
"""

from collections.abc import Iterable
from contextvars import ContextVar
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import UUID

from sqlalchemy import event, insert, inspect
from sqlalchemy.orm import Session, UOWTransaction

from claimforge_api.audit.models import AuditEvent
from claimforge_api.core.ids import uuid7
from claimforge_api.core.logging import request_id_var

#: The authenticated user making the current request (set by the auth dependency).
actor_id_var: ContextVar[UUID | None] = ContextVar("audit_actor_id", default=None)

REDACTED = "[redacted]"
_SENSITIVE = frozenset({"password_hash", "token_hash"})
# Bookkeeping columns that change on every write and add no information.
_IGNORED = frozenset({"created_at", "updated_at"})


def _json(value: object) -> object:
    if isinstance(value, UUID | Decimal):
        return str(value)
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, Enum):
        return value.value
    return value


def _entity_type(obj: object) -> str:
    """``__audit_entity__`` if the model sets one, else the table name minus a plural "s"."""
    explicit = getattr(obj, "__audit_entity__", None)
    if explicit:
        return str(explicit)
    return str(getattr(obj, "__tablename__", type(obj).__name__)).removesuffix("s")


def _organization_id(obj: object) -> UUID | None:
    if getattr(obj, "__tablename__", None) == "organizations":
        return getattr(obj, "id", None)
    value = getattr(obj, "organization_id", None)
    return value if isinstance(value, UUID) else None


def _column_changes(obj: object, *, created: bool) -> dict[str, list[object]]:
    changes: dict[str, list[object]] = {}
    state = inspect(obj)
    for attr in state.mapper.column_attrs:
        key = attr.key
        if key in _IGNORED or key == "id":
            continue
        history = state.attrs[key].history
        if created:
            after = getattr(obj, key)
            if after is None:
                continue
            before: object = None
        elif history.has_changes():
            before = history.deleted[0] if history.deleted else None
            after = history.added[0] if history.added else None
        else:
            continue
        if key in _SENSITIVE:
            changes[key] = [REDACTED if before is not None else None, REDACTED]
        else:
            changes[key] = [_json(before), _json(after)]
    return changes


def _final_values(obj: object) -> dict[str, list[object]]:
    """A hard-deleted row's last values as ``[value, None]``, so the log still says what
    was removed after the row itself is gone."""
    changes: dict[str, list[object]] = {}
    for attr in inspect(obj).mapper.column_attrs:
        key = attr.key
        if key in _IGNORED or key == "id":
            continue
        value = getattr(obj, key)
        if value is not None:
            changes[key] = [REDACTED if key in _SENSITIVE else _json(value), None]
    return changes


def _rows(session: Session) -> Iterable[dict[str, Any]]:
    actor = actor_id_var.get()
    request_id = request_id_var.get()

    def row(obj: object, verb: str, changes: dict[str, list[object]]) -> dict[str, Any]:
        entity = _entity_type(obj)
        return {
            "id": uuid7(),
            "organization_id": _organization_id(obj),
            "actor_user_id": actor,
            "action": f"{entity}.{verb}",
            "entity_type": entity,
            "entity_id": getattr(obj, "id"),  # noqa: B009 - audited models all have an id
            "changes": changes,
            "request_id": request_id,
        }

    for obj in session.new:
        if getattr(obj, "__audited__", False):
            yield row(obj, "created", _column_changes(obj, created=True))
    for obj in session.dirty:
        if not getattr(obj, "__audited__", False) or not session.is_modified(obj):
            continue
        changes = _column_changes(obj, created=False)
        if not changes:
            continue
        deleted = changes.get("deleted_at")
        verb = "deleted" if deleted and deleted[0] is None and deleted[1] is not None else "updated"
        if deleted and deleted[0] is not None and deleted[1] is None:
            verb = "restored"
        yield row(obj, verb, changes)
    for obj in session.deleted:
        if getattr(obj, "__audited__", False):
            yield row(obj, "deleted", _final_values(obj))


def _after_flush(session: Session, _context: UOWTransaction) -> None:
    rows = list(_rows(session))
    if rows:
        # Same connection and transaction as the change being recorded.
        session.connection().execute(insert(AuditEvent), rows)


def install() -> None:
    """Register the flush hook once per process."""
    if not event.contains(Session, "after_flush", _after_flush):
        event.listen(Session, "after_flush", _after_flush)
