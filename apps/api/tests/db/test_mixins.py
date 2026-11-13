"""Mixins against real Postgres, using a throwaway model outside the app metadata."""

import asyncio
from collections.abc import AsyncIterator

import pytest
from sqlalchemy import MetaData, String, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from claimforge_api.core.ids import uuid7_timestamp
from claimforge_api.db.mixins import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class _TestBase(DeclarativeBase):
    # Separate metadata so this table never leaks into migrations or the drift check.
    metadata = MetaData()


class Widget(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, _TestBase):
    __tablename__ = "mixin_test_widgets"

    name: Mapped[str] = mapped_column(String(50))


@pytest.fixture
async def engine(database_url: str) -> AsyncIterator[AsyncEngine]:
    engine = create_async_engine(database_url)
    async with engine.begin() as connection:
        await connection.run_sync(_TestBase.metadata.drop_all)
        await connection.run_sync(_TestBase.metadata.create_all)
    yield engine
    async with engine.begin() as connection:
        await connection.run_sync(_TestBase.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def session(engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    async with AsyncSession(engine, expire_on_commit=False) as session:
        yield session


async def test_columns_come_first_and_last_in_a_stable_order() -> None:
    columns = [c.name for c in Widget.__table__.columns]

    assert columns == ["id", "name", "created_at", "updated_at", "deleted_at"]


async def test_ids_and_timestamps_are_populated(session: AsyncSession) -> None:
    widget = Widget(name="Dehumidifier")
    session.add(widget)
    await session.commit()
    await session.refresh(widget)

    assert widget.id.version == 7
    assert widget.created_at.tzinfo is not None
    assert widget.updated_at == widget.created_at
    assert abs((uuid7_timestamp(widget.id) - widget.created_at).total_seconds()) < 5


async def test_updated_at_changes_on_update(session: AsyncSession) -> None:
    widget = Widget(name="Air mover")
    session.add(widget)
    await session.commit()
    await session.refresh(widget)
    created = widget.updated_at

    # now() is the transaction start time, so wait for a new transaction timestamp.
    await asyncio.sleep(0.01)
    widget.name = "Air mover #2"
    await session.commit()
    await session.refresh(widget)

    assert widget.updated_at > created
    assert widget.created_at == created


async def test_soft_delete_hides_rows_from_the_live_filter(session: AsyncSession) -> None:
    kept, removed = Widget(name="Kept"), Widget(name="Removed")
    session.add_all([kept, removed])
    await session.commit()

    removed.soft_delete()
    await session.commit()
    live = (await session.scalars(select(Widget.name).where(Widget.not_deleted()))).all()

    assert removed.is_deleted
    assert live == ["Kept"]

    removed.restore()
    await session.commit()
    assert not removed.is_deleted
