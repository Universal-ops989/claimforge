"""Keeping the organization's price lists.

Reading needs ``org:read``; changes need ``estimates:write``.
"""

from uuid import UUID

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.auth.permissions import Permission, authorize
from claimforge_api.core.errors import ConflictError, NotFoundError
from claimforge_api.db.pagination import Page, SortKey, paginate
from claimforge_api.db.search import icontains
from claimforge_api.pricing import imports
from claimforge_api.pricing.models import PriceItem, PriceList
from claimforge_api.pricing.schemas import (
    ImportResult,
    PriceItemCreate,
    PriceItemQuery,
    PriceItemUpdate,
    PriceListCreate,
    PriceListRead,
    PriceListUpdate,
)
from claimforge_api.users.models import User

BY_CODE = SortKey([PriceItem.code, PriceItem.id])


class PriceListNameTakenError(ConflictError):
    code = "price_list_name_taken"
    title = "A price list already has this name"


class PriceCodeTakenError(ConflictError):
    code = "price_code_taken"
    title = "This list already has an item with this code"


# ─── Lists ────────────────────────────────────────────────────────────────────


async def _get_list(session: AsyncSession, organization_id: UUID, list_id: UUID) -> PriceList:
    found = await session.scalar(
        select(PriceList)
        .where(PriceList.id == list_id, PriceList.organization_id == organization_id)
        .execution_options(populate_existing=True)
    )
    if found is None:
        raise NotFoundError("Price list not found", price_list_id=str(list_id))
    return found


async def _item_counts(session: AsyncSession, list_ids: list[UUID]) -> dict[UUID, int]:
    if not list_ids:
        return {}
    rows = await session.execute(
        select(PriceItem.price_list_id, func.count())
        .where(PriceItem.price_list_id.in_(list_ids))
        .group_by(PriceItem.price_list_id)
    )
    return {list_id: count for list_id, count in rows}


async def present(session: AsyncSession, price_list: PriceList) -> PriceListRead:
    counts = await _item_counts(session, [price_list.id])
    return _read(price_list, counts.get(price_list.id, 0))


def _read(price_list: PriceList, item_count: int) -> PriceListRead:
    return PriceListRead(
        id=price_list.id,
        name=price_list.name,
        description=price_list.description,
        effective_on=price_list.effective_on,
        is_default=price_list.is_default,
        item_count=item_count,
        imported_at=price_list.imported_at,
        created_at=price_list.created_at,
        updated_at=price_list.updated_at,
    )


async def _check_name(
    session: AsyncSession, organization_id: UUID, name: str, *, ignore: UUID | None = None
) -> None:
    statement = select(PriceList.id).where(
        PriceList.organization_id == organization_id, func.lower(PriceList.name) == name.lower()
    )
    if ignore is not None:
        statement = statement.where(PriceList.id != ignore)
    if await session.scalar(statement) is not None:
        raise PriceListNameTakenError(f"There's already a price list called {name}", name=name)


async def _step_down_default(
    session: AsyncSession, organization_id: UUID, *, keep: UUID | None = None
) -> None:
    """Unset the current default (audited), before another list becomes it."""
    current = await session.scalar(
        select(PriceList).where(
            PriceList.organization_id == organization_id, PriceList.is_default.is_(True)
        )
    )
    if current is not None and current.id != keep:
        current.is_default = False
        # Flushed now: the one-default index must never see two at once.
        await session.flush()


async def list_price_lists(
    session: AsyncSession, organization_id: UUID, *, user: User
) -> list[PriceListRead]:
    """The default first, then by name."""
    await authorize(session, user, organization_id, Permission.ORG_READ)
    lists = list(
        await session.scalars(
            select(PriceList)
            .where(PriceList.organization_id == organization_id)
            .order_by(PriceList.is_default.desc(), func.lower(PriceList.name))
        )
    )
    counts = await _item_counts(session, [lst.id for lst in lists])
    return [_read(lst, counts.get(lst.id, 0)) for lst in lists]


async def get_price_list(
    session: AsyncSession, organization_id: UUID, list_id: UUID, *, user: User
) -> PriceList:
    await authorize(session, user, organization_id, Permission.ORG_READ)
    return await _get_list(session, organization_id, list_id)


async def create_price_list(
    session: AsyncSession, organization_id: UUID, data: PriceListCreate, *, user: User
) -> PriceList:
    await authorize(session, user, organization_id, Permission.ESTIMATES_WRITE)
    await _check_name(session, organization_id, data.name)
    if data.is_default:
        await _step_down_default(session, organization_id)
    price_list = PriceList(organization_id=organization_id, **data.model_dump())
    session.add(price_list)
    await session.commit()
    return await _get_list(session, organization_id, price_list.id)


async def update_price_list(
    session: AsyncSession,
    organization_id: UUID,
    list_id: UUID,
    data: PriceListUpdate,
    *,
    user: User,
) -> PriceList:
    await authorize(session, user, organization_id, Permission.ESTIMATES_WRITE)
    price_list = await _get_list(session, organization_id, list_id)
    changes = data.model_dump(exclude_unset=True)
    name = changes.get("name")
    if name is not None and name.lower() != price_list.name.lower():
        await _check_name(session, organization_id, name, ignore=price_list.id)
    if changes.get("is_default"):
        await _step_down_default(session, organization_id, keep=price_list.id)
    for field, value in changes.items():
        setattr(price_list, field, value)
    # Unchanged values leave no history, so a no-op writes neither a row nor an audit event.
    await session.commit()
    return await _get_list(session, organization_id, list_id)


async def delete_price_list(
    session: AsyncSession, organization_id: UUID, list_id: UUID, *, user: User
) -> None:
    """Delete a list and its items."""
    await authorize(session, user, organization_id, Permission.ESTIMATES_WRITE)
    price_list = await _get_list(session, organization_id, list_id)
    await session.delete(price_list)
    await session.commit()


# ─── Items ────────────────────────────────────────────────────────────────────


def _items(organization_id: UUID, list_id: UUID) -> Select[PriceItem]:
    return select(PriceItem).where(
        PriceItem.price_list_id == list_id, PriceItem.organization_id == organization_id
    )


async def _get_item(
    session: AsyncSession, organization_id: UUID, list_id: UUID, item_id: UUID
) -> PriceItem:
    item = await session.scalar(
        _items(organization_id, list_id)
        .where(PriceItem.id == item_id)
        .execution_options(populate_existing=True)
    )
    if item is None:
        raise NotFoundError("Price item not found", price_item_id=str(item_id))
    return item


async def _check_code(
    session: AsyncSession, list_id: UUID, code: str, *, ignore: UUID | None = None
) -> None:
    statement = select(PriceItem.id).where(
        PriceItem.price_list_id == list_id, func.lower(PriceItem.code) == code.lower()
    )
    if ignore is not None:
        statement = statement.where(PriceItem.id != ignore)
    if await session.scalar(statement) is not None:
        raise PriceCodeTakenError(f"{code} is already on this list", price_code=code)


async def list_items(
    session: AsyncSession,
    organization_id: UUID,
    list_id: UUID,
    query: PriceItemQuery,
    *,
    user: User,
    limit: int,
    cursor: str | None,
) -> Page[PriceItem]:
    """A list's items by code."""
    await authorize(session, user, organization_id, Permission.ORG_READ)
    await _get_list(session, organization_id, list_id)
    statement = _items(organization_id, list_id)
    if query.category:
        statement = statement.where(func.lower(PriceItem.category) == query.category.lower())
    if query.q and query.q.strip():
        statement = statement.where(
            or_(icontains(PriceItem.code, query.q), icontains(PriceItem.description, query.q))
        )
    return await paginate(session, statement, BY_CODE, limit=limit, cursor=cursor)


async def get_item(
    session: AsyncSession, organization_id: UUID, list_id: UUID, item_id: UUID, *, user: User
) -> PriceItem:
    await authorize(session, user, organization_id, Permission.ORG_READ)
    return await _get_item(session, organization_id, list_id, item_id)


async def create_item(
    session: AsyncSession,
    organization_id: UUID,
    list_id: UUID,
    data: PriceItemCreate,
    *,
    user: User,
) -> PriceItem:
    await authorize(session, user, organization_id, Permission.ESTIMATES_WRITE)
    await _get_list(session, organization_id, list_id)
    await _check_code(session, list_id, data.code)
    item = PriceItem(organization_id=organization_id, price_list_id=list_id, **data.model_dump())
    session.add(item)
    await session.commit()
    return await _get_item(session, organization_id, list_id, item.id)


async def update_item(
    session: AsyncSession,
    organization_id: UUID,
    list_id: UUID,
    item_id: UUID,
    data: PriceItemUpdate,
    *,
    user: User,
) -> PriceItem:
    await authorize(session, user, organization_id, Permission.ESTIMATES_WRITE)
    item = await _get_item(session, organization_id, list_id, item_id)
    changes = data.model_dump(exclude_unset=True)
    code = changes.get("code")
    if code is not None and code.lower() != item.code.lower():
        await _check_code(session, list_id, code, ignore=item.id)
    for field, value in changes.items():
        setattr(item, field, value)
    await session.commit()
    return await _get_item(session, organization_id, list_id, item_id)


async def delete_item(
    session: AsyncSession, organization_id: UUID, list_id: UUID, item_id: UUID, *, user: User
) -> None:
    await authorize(session, user, organization_id, Permission.ESTIMATES_WRITE)
    item = await _get_item(session, organization_id, list_id, item_id)
    await session.delete(item)
    await session.commit()


async def import_items(
    session: AsyncSession,
    organization_id: UUID,
    list_id: UUID,
    data: bytes,
    mode: imports.ImportMode,
    *,
    dry_run: bool,
    user: User,
) -> ImportResult:
    """Bring a CSV file's items into a list: all of them, or none if any row is wrong."""
    await authorize(session, user, organization_id, Permission.ESTIMATES_WRITE)
    price_list = await _get_list(session, organization_id, list_id)
    parsed = imports.parse(data)
    if parsed.errors:
        raise imports.ImportInvalidError(
            f"{len(parsed.errors)} problem(s) in the file; nothing was imported",
            error_count=len(parsed.errors),
            row_errors=[
                {"line": e.line, "column": e.column, "message": e.message}
                for e in parsed.errors[: imports.MAX_ERRORS]
            ],
        )
    outcome = await imports.apply(session, price_list, parsed.rows, mode, dry_run=dry_run)
    return ImportResult(
        mode=mode.value,
        dry_run=dry_run,
        rows=outcome.rows,
        added=outcome.added,
        updated=outcome.updated,
        unchanged=outcome.unchanged,
        removed=outcome.removed,
        ignored_columns=parsed.ignored_columns,
    )
