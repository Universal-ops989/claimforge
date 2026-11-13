from fastapi import FastAPI
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker


async def test_sessions_round_trip_through_postgres(app: FastAPI) -> None:
    factory: async_sessionmaker[AsyncSession] = app.state.session_factory

    async with factory() as session:
        version = (await session.execute(text("SHOW server_version_num"))).scalar_one()

    assert int(version) >= 160000


async def test_uncommitted_work_is_rolled_back(app: FastAPI) -> None:
    factory: async_sessionmaker[AsyncSession] = app.state.session_factory

    async with factory() as session:
        await session.execute(text("CREATE TEMP TABLE scratch (id int) ON COMMIT PRESERVE ROWS"))
        await session.execute(text("INSERT INTO scratch VALUES (1)"))
        await session.rollback()
        exists = (
            await session.execute(text("SELECT to_regclass('pg_temp.scratch') IS NOT NULL"))
        ).scalar_one()

    assert exists is False
