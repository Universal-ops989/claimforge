"""Shared FastAPI dependencies."""

from collections.abc import AsyncIterator
from typing import Annotated, cast

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from claimforge_api.core.settings import Settings


def get_app_settings(request: Request) -> Settings:
    """Settings of the app handling this request (each test app can have its own)."""
    return cast("Settings", request.app.state.settings)


def get_engine(request: Request) -> AsyncEngine:
    """The database engine owned by the app handling this request."""
    return cast("AsyncEngine", request.app.state.engine)


async def get_db_session(request: Request) -> AsyncIterator[AsyncSession]:
    """One session per request.

    Services commit explicitly when their unit of work succeeds; anything left
    uncommitted (for example after an exception) is rolled back here.
    """
    factory = cast("async_sessionmaker[AsyncSession]", request.app.state.session_factory)
    async with factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


SettingsDep = Annotated[Settings, Depends(get_app_settings)]
EngineDep = Annotated[AsyncEngine, Depends(get_engine)]
DbSession = Annotated[AsyncSession, Depends(get_db_session)]
