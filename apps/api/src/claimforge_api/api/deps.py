"""Shared FastAPI dependencies."""

from collections.abc import AsyncIterator
from typing import Annotated, cast

from fastapi import Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from claimforge_api.core.settings import Settings
from claimforge_api.db.pagination import DEFAULT_LIMIT, MAX_LIMIT


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


class PageParams:
    """``?limit=`` and ``?cursor=`` query parameters for list endpoints."""

    def __init__(
        self,
        limit: Annotated[
            int, Query(ge=1, le=MAX_LIMIT, description="Items per page")
        ] = DEFAULT_LIMIT,
        cursor: Annotated[
            str | None, Query(description="next_cursor from the previous page")
        ] = None,
    ) -> None:
        self.limit = limit
        self.cursor = cursor


SettingsDep = Annotated[Settings, Depends(get_app_settings)]
EngineDep = Annotated[AsyncEngine, Depends(get_engine)]
DbSession = Annotated[AsyncSession, Depends(get_db_session)]
PageParamsDep = Annotated[PageParams, Depends()]
