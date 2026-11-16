"""Importing price items from CSV.

Parsing is a pure function from text to validated rows (or every problem, by line), so the
rules are easy to test; :func:`apply` then merges the rows into a list. Nothing is changed
unless every row is valid.
"""

import csv
import io
from dataclasses import dataclass, field
from datetime import UTC, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.core.errors import BusinessRuleError
from claimforge_api.pricing.models import PriceItem, PriceList
from claimforge_api.pricing.schemas import PriceItemCreate

MAX_BYTES = 5 * 1024 * 1024
MAX_ROWS = 50_000
#: Problems listed in one answer; the count says how many there were in all.
MAX_ERRORS = 100

REQUIRED = ("code", "description", "unit", "unit_price")
OPTIONAL = ("category",)
ALIASES = {"price": "unit_price", "unit price": "unit_price", "uom": "unit"}


class ImportMode(StrEnum):
    MERGE = "merge"  # add new codes, update changed ones
    REPLACE = "replace"  # merge, and remove codes the file doesn't have


class ImportInvalidError(BusinessRuleError):
    code = "import_invalid"
    title = "The file can't be imported"


@dataclass(frozen=True)
class RowError:
    line: int
    column: str | None
    message: str


@dataclass
class Parsed:
    rows: list[PriceItemCreate] = field(default_factory=list)
    errors: list[RowError] = field(default_factory=list)
    ignored_columns: list[str] = field(default_factory=list)


def _decode(data: bytes) -> str:
    try:
        return data.decode("utf-8-sig")  # spreadsheets often start with a byte-order mark
    except UnicodeDecodeError:
        raise ImportInvalidError(
            'The file isn\'t UTF-8 text; save it as "CSV UTF-8" and try again'
        ) from None


def _delimiter(header: str) -> str:
    """Comma, unless the header plainly uses semicolons (European Excel) or tabs."""
    counts = {d: header.count(d) for d in (",", ";", "\t")}
    return max(counts, key=lambda d: counts[d]) if any(counts.values()) else ","


def _price(value: str) -> str:
    """$1,234.50 -> 1234.50, as spreadsheets like to show money."""
    return value.strip().removeprefix("$").replace(",", "").strip()


def _column(name: str) -> str:
    key = " ".join(name.strip().lower().replace("_", " ").split())
    return ALIASES.get(key, key.replace(" ", "_"))


def parse(data: bytes) -> Parsed:
    """Every row validated, or every problem found, by line (the header is line 1)."""
    text = _decode(data)
    lines = text.splitlines()
    if not lines or not lines[0].strip():
        raise ImportInvalidError("The file is empty: it needs a header row and items")
    reader = csv.reader(io.StringIO(text), delimiter=_delimiter(lines[0]))
    header = [_column(name) for name in next(reader)]
    missing = [name for name in REQUIRED if name not in header]
    if missing:
        raise ImportInvalidError(
            f"Missing columns: {', '.join(missing)}",
            missing_columns=missing,
            found_columns=header,
        )
    wanted = {name: header.index(name) for name in (*REQUIRED, *OPTIONAL) if name in header}
    parsed = Parsed(ignored_columns=[h for h in header if h not in wanted and h])
    seen: dict[str, int] = {}
    for line, cells in enumerate(reader, start=2):
        if not any(cell.strip() for cell in cells):
            continue  # blank lines at the end of a sheet
        if len(parsed.rows) + len(parsed.errors) >= MAX_ROWS:
            raise ImportInvalidError(f"Files can have at most {MAX_ROWS} items", limit=MAX_ROWS)
        values: dict[str, Any] = {}
        for name, index in wanted.items():
            cell = cells[index] if index < len(cells) else ""
            values[name] = _price(cell) if name == "unit_price" else cell
        if not values.get("category", "").strip():
            values["category"] = None
        try:
            row = PriceItemCreate.model_validate(values)
        except ValidationError as error:
            for problem in error.errors():
                column = str(problem["loc"][0]) if problem["loc"] else None
                parsed.errors.append(RowError(line, column, problem["msg"]))
            continue
        first = seen.setdefault(row.code.lower(), line)
        if first != line:
            parsed.errors.append(RowError(line, "code", f"{row.code} is already on line {first}"))
            continue
        parsed.rows.append(row)
    return parsed


@dataclass(frozen=True)
class Outcome:
    rows: int
    added: int
    updated: int
    unchanged: int
    removed: int


_FIELDS = ("code", "description", "unit", "unit_price", "category")


def _same(item: PriceItem, row: PriceItemCreate) -> bool:
    return all(
        Decimal(getattr(item, name)) == getattr(row, name)
        if name == "unit_price"
        else getattr(item, name) == getattr(row, name)
        for name in _FIELDS
    )


async def apply(
    session: AsyncSession,
    price_list: PriceList,
    rows: list[PriceItemCreate],
    mode: ImportMode,
    *,
    dry_run: bool,
) -> Outcome:
    """Merge ``rows`` into ``price_list``; commit unless ``dry_run``."""
    existing = {
        item.code.lower(): item
        for item in await session.scalars(
            select(PriceItem).where(PriceItem.price_list_id == price_list.id)
        )
    }
    added = updated = unchanged = 0
    for row in rows:
        item = existing.pop(row.code.lower(), None)
        if item is None:
            added += 1
            if not dry_run:
                session.add(
                    PriceItem(
                        organization_id=price_list.organization_id,
                        price_list_id=price_list.id,
                        **row.model_dump(),
                    )
                )
        elif _same(item, row):
            unchanged += 1
        else:
            updated += 1
            if not dry_run:
                for name in _FIELDS:
                    setattr(item, name, getattr(row, name))
    removed = len(existing) if mode == ImportMode.REPLACE else 0
    if not dry_run:  # a dry run changed nothing, so there's nothing to undo
        if mode == ImportMode.REPLACE:
            for item in existing.values():
                await session.delete(item)
        price_list.imported_at = datetime.now(UTC)
        await session.commit()
    return Outcome(len(rows), added, updated, unchanged, removed)
