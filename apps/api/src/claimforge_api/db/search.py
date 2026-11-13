"""Case-insensitive substring matching for list filters.

A stopgap until full-text search (roadmap item 75). User input is escaped, so ``%`` and
``_`` match literally instead of acting as wildcards.
"""

from typing import Any

from sqlalchemy import ColumnElement
from sqlalchemy.orm import InstrumentedAttribute

LIKE_ESCAPE = "\\"


def escape_like(text: str) -> str:
    for char in (LIKE_ESCAPE, "%", "_"):
        text = text.replace(char, LIKE_ESCAPE + char)
    return text


def icontains(column: InstrumentedAttribute[Any], text: str) -> ColumnElement[bool]:
    """``column ILIKE '%text%'`` with ``text`` taken literally."""
    return column.ilike(f"%{escape_like(text.strip())}%", escape=LIKE_ESCAPE)
