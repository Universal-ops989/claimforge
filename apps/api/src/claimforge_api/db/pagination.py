"""Keyset (cursor) pagination.

A page is "the next N rows after the last row of the previous page" in a fixed order.
Unlike OFFSET, this stays fast on large tables and never skips or repeats rows when
rows are inserted between requests. The order always ends with the primary key, so
rows with equal sort values still have a stable, unique position.
"""

import base64
import binascii
import json
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import Select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from claimforge_api.core.errors import AppError

MAX_LIMIT = 100
DEFAULT_LIMIT = 25


class InvalidCursorError(AppError):
    status = 400
    code = "invalid_cursor"
    title = "Invalid cursor"


@dataclass(frozen=True)
class Page[T]:
    """One page of ORM objects, as returned by :func:`paginate`."""

    items: list[T]
    next_cursor: str | None
    has_more: bool


class CursorPage[T](BaseModel):
    """Response schema for a page. Pass ``next_cursor`` back as ``?cursor=``."""

    items: list[T]
    next_cursor: str | None
    has_more: bool


@dataclass(frozen=True)
class SortKey:
    """Columns to order by, ending with a unique column (usually ``id``)."""

    columns: Sequence[InstrumentedAttribute[Any]]
    direction: Literal["asc", "desc"] = "asc"

    @property
    def fingerprint(self) -> str:
        names = ",".join(f"{c.class_.__name__}.{c.key}" for c in self.columns)
        return f"{names}:{self.direction}"


def _to_json(value: object) -> object:
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, UUID | Decimal):
        return str(value)
    return value


def _from_json(value: object, column: InstrumentedAttribute[Any]) -> object:
    if value is None:
        return None
    python_type = column.type.python_type
    if python_type is datetime:
        return datetime.fromisoformat(str(value))
    if python_type is date:
        return date.fromisoformat(str(value))
    if python_type in (UUID, Decimal):
        return python_type(str(value))
    return value


def encode_cursor(sort: SortKey, values: Sequence[object]) -> str:
    payload = {"s": sort.fingerprint, "v": [_to_json(v) for v in values]}
    raw = json.dumps(payload, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def decode_cursor(sort: SortKey, cursor: str) -> list[object]:
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded.encode()))
        if not isinstance(payload, dict) or payload.get("s") != sort.fingerprint:
            raise InvalidCursorError("This cursor belongs to a different sort order")
        values = payload["v"]
        if not isinstance(values, list) or len(values) != len(sort.columns):
            raise InvalidCursorError("Malformed cursor")
        return [_from_json(v, c) for v, c in zip(values, sort.columns, strict=True)]
    except InvalidCursorError:
        raise
    except (ValueError, KeyError, TypeError, binascii.Error) as exc:
        raise InvalidCursorError("Malformed cursor") from exc


def _after(sort: SortKey, values: Sequence[object]) -> Any:
    """Row-value comparison "(a, b, id) > (va, vb, vid)", spelled out to handle any types."""
    clauses = []
    for i, column in enumerate(sort.columns):
        equal_prefix = [sort.columns[j] == values[j] for j in range(i)]
        beyond = column > values[i] if sort.direction == "asc" else column < values[i]
        clauses.append(and_(*equal_prefix, beyond))
    return or_(*clauses)


async def paginate[T](
    session: AsyncSession,
    statement: Select[T],
    sort: SortKey,
    *,
    limit: int = DEFAULT_LIMIT,
    cursor: str | None = None,
) -> Page[T]:
    """Fetch one page of ``statement`` (a select of ORM entities) in ``sort`` order."""
    limit = max(1, min(limit, MAX_LIMIT))
    ordering = [c.asc() if sort.direction == "asc" else c.desc() for c in sort.columns]
    query = statement.order_by(*ordering)
    if cursor:
        query = query.where(_after(sort, decode_cursor(sort, cursor)))

    # Fetch one extra row to know whether another page exists.
    rows = list((await session.scalars(query.limit(limit + 1))).all())
    has_more = len(rows) > limit
    items = rows[:limit]

    next_cursor = None
    if has_more and items:
        last = items[-1]
        next_cursor = encode_cursor(sort, [getattr(last, c.key) for c in sort.columns])
    return Page(items=items, next_cursor=next_cursor, has_more=has_more)
