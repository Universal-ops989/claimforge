"""Shared pytest fixtures for the API test suite.

Database tests run against real PostgreSQL:
- CI provides one through ``CLAIMFORGE_TEST_DATABASE_URL`` (a service container);
- locally, when that variable is unset, an embedded server from ``pgserver`` is started
  once per test session, so no Docker is needed.

The schema is migrated once per session. Each test then runs inside a transaction that is
rolled back afterwards, so tests never see each other's data even when code under test
calls ``commit()`` (commits become SAVEPOINT releases).
"""

import os
import tempfile
from collections.abc import AsyncIterator, Awaitable, Callable, Iterator
from pathlib import Path
from uuid import UUID

import httpx2
import pytest
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from pydantic import PostgresDsn
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from claimforge_api.api.deps import get_db_session
from claimforge_api.audit import recorder as audit_recorder
from claimforge_api.core import passwords
from claimforge_api.core.settings import Environment, Settings
from claimforge_api.core.tokens import create_access_token
from claimforge_api.main import create_app
from claimforge_api.organizations import service as organizations_service
from claimforge_api.organizations.schemas import OrganizationCreate
from claimforge_api.users import service as users_service
from claimforge_api.users.models import Membership, Role, User

API_ROOT = Path(__file__).resolve().parents[1]

ClientFor = Callable[[Role | None], Awaitable[httpx2.AsyncClient]]


def make_alembic_config(database_url: str) -> Config:
    config = Config(str(API_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(API_ROOT / "migrations"))
    config.set_main_option("sqlalchemy.url", database_url)
    config.attributes["configure_logger"] = False
    return config


@pytest.fixture(scope="session", autouse=True)
def audit_hook() -> None:
    """Service-level tests flush without building an app, so install the hook here too."""
    audit_recorder.install()


@pytest.fixture(autouse=True)
def fast_password_hashing(monkeypatch: pytest.MonkeyPatch) -> None:
    """Production scrypt takes ~0.3s per hash; tests use a cheap cost."""
    monkeypatch.setattr(passwords, "hasher", passwords.PasswordHasher(log_n=10))


@pytest.fixture(scope="session")
def database_url() -> Iterator[str]:
    """Async SQLAlchemy URL of a disposable test database."""
    configured = os.environ.get("CLAIMFORGE_TEST_DATABASE_URL")
    if configured:
        yield configured
        return

    # Imported lazily: only needed when no external database is configured.
    from pgserver.postgres_server import get_server

    # On Windows the server can briefly keep its log open after stopping.
    with tempfile.TemporaryDirectory(
        prefix="claimforge-pg-", ignore_cleanup_errors=True
    ) as data_dir:
        server = get_server(data_dir, cleanup_mode="stop")
        uri: str = server.get_uri()
        yield uri.replace("postgresql://", "postgresql+asyncpg://", 1)
        server.cleanup()


@pytest.fixture
def alembic_config(database_url: str) -> Config:
    return make_alembic_config(database_url)


@pytest.fixture(scope="session")
def migrated_database_url(database_url: str) -> str:
    """The test database, upgraded to the latest migration once per session."""
    command.upgrade(make_alembic_config(database_url), "head")
    return database_url


@pytest.fixture
async def db_session(migrated_database_url: str) -> AsyncIterator[AsyncSession]:
    """A session inside a transaction that is rolled back after the test."""
    engine = create_async_engine(migrated_database_url, poolclass=NullPool)
    async with engine.connect() as connection:
        transaction = await connection.begin()
        session = AsyncSession(
            bind=connection,
            join_transaction_mode="create_savepoint",
            expire_on_commit=False,
        )
        try:
            yield session
        finally:
            await session.close()
            await transaction.rollback()
    await engine.dispose()


@pytest.fixture
def settings(database_url: str) -> Settings:
    """Test settings, independent of any developer .env file."""
    return Settings(
        _env_file=None,
        environment=Environment.TEST,
        database_url=PostgresDsn(database_url),
    )


@pytest.fixture
async def app(settings: Settings, db_session: AsyncSession) -> AsyncIterator[FastAPI]:
    """A fresh app per test, whose requests share the test's rolled-back session."""
    application = create_app(settings)

    async def test_session() -> AsyncIterator[AsyncSession]:
        yield db_session

    application.dependency_overrides[get_db_session] = test_session
    yield application
    await application.state.engine.dispose()


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[httpx2.AsyncClient]:
    """An async HTTP client bound to the in-process ASGI app (no network)."""
    transport = httpx2.ASGITransport(app=app)
    async with httpx2.AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c


@pytest.fixture
async def user(db_session: AsyncSession) -> User:
    """A signed-up user (no organization yet)."""
    return await users_service.create_user(
        db_session,
        email="member@example.com",
        full_name="Morgan Member",
        password="tile grout and drywall",
    )


@pytest.fixture
def access_token(user: User, settings: Settings) -> str:
    return create_access_token(user.id, settings).token


@pytest.fixture
async def auth_client(app: FastAPI, access_token: str) -> AsyncIterator[httpx2.AsyncClient]:
    """Like ``client``, but signed in as ``user``."""
    transport = httpx2.ASGITransport(app=app)
    async with httpx2.AsyncClient(
        transport=transport,
        base_url="http://testserver",
        headers={"Authorization": f"Bearer {access_token}"},
    ) as c:
        yield c


@pytest.fixture
async def organization_id(db_session: AsyncSession, user: User) -> UUID:
    """An organization owned by ``user``."""
    organization = await organizations_service.create_organization(
        db_session, OrganizationCreate(name="Rivera Restoration"), owner=user
    )
    return organization.id


@pytest.fixture
async def client_for(
    app: FastAPI, db_session: AsyncSession, settings: Settings, organization_id: UUID
) -> AsyncIterator[ClientFor]:
    """Factory: a signed-in client for a new member of ``organization_id`` with ``role``.

    ``None`` gives a signed-in user who is not a member.
    """
    clients: list[httpx2.AsyncClient] = []

    async def make(role: Role | None) -> httpx2.AsyncClient:
        person = await users_service.create_user(
            db_session, email=f"{role or 'outsider'}@example.com", full_name="Someone"
        )
        if role is not None:
            db_session.add(
                Membership(organization_id=organization_id, user_id=person.id, role=role)
            )
            await db_session.commit()
        client = httpx2.AsyncClient(
            transport=httpx2.ASGITransport(app=app),
            base_url="http://testserver",
            headers={"Authorization": f"Bearer {create_access_token(person.id, settings).token}"},
        )
        clients.append(client)
        return client

    yield make
    for client in clients:
        await client.aclose()
