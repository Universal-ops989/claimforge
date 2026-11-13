"""Async database engine and session factory.

The engine is owned by the application instance (created in ``create_app``, disposed in
the lifespan on shutdown), never by the module, so tests can run several apps against
different databases.
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from claimforge_api.core.settings import Settings


def create_engine(settings: Settings) -> AsyncEngine:
    """Create the async engine configured from settings."""
    return create_async_engine(
        str(settings.database_url),
        pool_size=settings.database_pool_size,
        pool_pre_ping=True,
        echo=settings.database_echo,
    )


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    """Session factory. ``expire_on_commit=False`` keeps loaded objects usable after commit."""
    return async_sessionmaker(engine, expire_on_commit=False, autoflush=False)


async def ping(engine: AsyncEngine) -> None:
    """Raise if the database can't answer a trivial query."""
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))
