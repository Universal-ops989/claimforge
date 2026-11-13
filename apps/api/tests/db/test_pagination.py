"""Keyset pagination against real Postgres, with a throwaway table."""

from collections.abc import AsyncIterator
from datetime import date, timedelta

import pytest
from sqlalchemy import Date, MetaData, String, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from claimforge_api.db.mixins import UUIDPrimaryKeyMixin
from claimforge_api.db.pagination import (
    InvalidCursorError,
    SortKey,
    decode_cursor,
    encode_cursor,
    paginate,
)


class _TestBase(DeclarativeBase):
    metadata = MetaData()


class Item(UUIDPrimaryKeyMixin, _TestBase):
    __tablename__ = "pagination_test_items"

    name: Mapped[str] = mapped_column(String(20))
    loss_date: Mapped[date] = mapped_column(Date)


BY_ID = SortKey([Item.id])
BY_DATE_DESC = SortKey([Item.loss_date, Item.id], direction="desc")


@pytest.fixture
async def session(database_url: str) -> AsyncIterator[AsyncSession]:
    engine: AsyncEngine = create_async_engine(database_url)
    async with engine.begin() as connection:
        await connection.run_sync(_TestBase.metadata.drop_all)
        await connection.run_sync(_TestBase.metadata.create_all)
    async with AsyncSession(engine, expire_on_commit=False) as session:
        start = date(2026, 1, 1)
        # 23 rows; dates repeat every 5 rows so the tiebreaker matters.
        session.add_all(
            Item(name=f"item-{i:02d}", loss_date=start + timedelta(days=i % 5)) for i in range(23)
        )
        await session.commit()
        yield session
    async with engine.begin() as connection:
        await connection.run_sync(_TestBase.metadata.drop_all)
    await engine.dispose()


async def collect(session: AsyncSession, sort: SortKey, limit: int) -> list[list[Item]]:
    pages: list[list[Item]] = []
    cursor = None
    while True:
        page = await paginate(session, select(Item), sort, limit=limit, cursor=cursor)
        pages.append(page.items)
        if not page.has_more:
            assert page.next_cursor is None
            return pages
        cursor = page.next_cursor


async def test_walks_every_row_exactly_once_in_creation_order(session: AsyncSession) -> None:
    pages = await collect(session, BY_ID, limit=10)

    assert [len(p) for p in pages] == [10, 10, 3]
    names = [item.name for page in pages for item in page]
    assert names == [f"item-{i:02d}" for i in range(23)]  # UUIDv7 ids follow insert order


async def test_descending_sort_with_ties_is_stable(session: AsyncSession) -> None:
    pages = await collect(session, BY_DATE_DESC, limit=4)
    rows = [item for page in pages for item in page]

    assert len({item.id for item in rows}) == 23
    keys = [(item.loss_date, item.id) for item in rows]
    assert keys == sorted(keys, reverse=True)


async def test_new_rows_do_not_shift_later_pages(session: AsyncSession) -> None:
    first = await paginate(session, select(Item), BY_ID, limit=10)
    session.add(Item(name="late", loss_date=date(2026, 1, 1)))
    await session.commit()

    second = await paginate(session, select(Item), BY_ID, limit=10, cursor=first.next_cursor)

    assert second.items[0].name == "item-10"  # nothing skipped or repeated


async def test_limit_is_clamped(session: AsyncSession) -> None:
    page = await paginate(session, select(Item), BY_ID, limit=10_000)

    assert len(page.items) == 23
    assert not page.has_more


def test_cursor_round_trips_typed_values() -> None:
    values = [date(2026, 11, 2), Item.id.type.python_type("01937c4e-0000-7000-8000-000000000000")]

    assert decode_cursor(BY_DATE_DESC, encode_cursor(BY_DATE_DESC, values)) == values


@pytest.mark.parametrize("bad", ["not-base64!!", "e30", "eyJzIjoiPyJ9"])
def test_rejects_malformed_cursors(bad: str) -> None:
    with pytest.raises(InvalidCursorError):
        decode_cursor(BY_ID, bad)


def test_rejects_cursors_from_a_different_sort() -> None:
    cursor = encode_cursor(BY_ID, ["01937c4e-0000-7000-8000-000000000000"])

    with pytest.raises(InvalidCursorError, match="different sort"):
        decode_cursor(BY_DATE_DESC, cursor)
