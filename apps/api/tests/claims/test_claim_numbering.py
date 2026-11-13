import asyncio
from collections.abc import AsyncIterator
from uuid import UUID

import pytest
from sqlalchemy import delete, insert
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from claimforge_api.claims.numbering import format_claim_number, next_claim_number
from claimforge_api.core.ids import uuid7
from claimforge_api.organizations import service as organizations
from claimforge_api.organizations.models import Organization
from claimforge_api.organizations.schemas import OrganizationCreate
from claimforge_api.users.models import User


def test_format() -> None:
    assert format_claim_number(2026, 42) == "2026-00042"
    assert format_claim_number(2026, 123_456) == "2026-123456"


async def test_sequential_per_organization_and_year(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    other = await organizations.create_organization(
        db_session, OrganizationCreate(name="Other Org"), owner=user
    )

    issued = [
        await next_claim_number(db_session, organization_id, 2026),
        await next_claim_number(db_session, organization_id, 2026),
        await next_claim_number(db_session, other.id, 2026),
        await next_claim_number(db_session, organization_id, 2027),
        await next_claim_number(db_session, organization_id, 2026),
    ]

    assert issued == ["2026-00001", "2026-00002", "2026-00001", "2027-00001", "2026-00003"]


async def test_a_rolled_back_create_does_not_burn_a_number(
    db_session: AsyncSession, organization_id: UUID
) -> None:
    assert await next_claim_number(db_session, organization_id, 2026) == "2026-00001"
    await db_session.commit()

    assert await next_claim_number(db_session, organization_id, 2026) == "2026-00002"
    await db_session.rollback()

    assert await next_claim_number(db_session, organization_id, 2026) == "2026-00002"


@pytest.fixture
async def committed_organization(migrated_database_url: str) -> AsyncIterator[tuple[str, UUID]]:
    """A real, committed organization, for tests that need several connections."""
    engine = create_async_engine(migrated_database_url, poolclass=NullPool)
    organization_id = uuid7()
    async with engine.begin() as connection:
        await connection.execute(
            insert(Organization).values(
                id=organization_id, name="Race Co", slug=f"race-{organization_id}"
            )
        )
    yield migrated_database_url, organization_id
    async with engine.begin() as connection:  # counters cascade with the organization
        await connection.execute(delete(Organization).where(Organization.id == organization_id))
    await engine.dispose()


async def test_concurrent_creates_queue_up_instead_of_colliding(
    committed_organization: tuple[str, UUID],
) -> None:
    url, organization_id = committed_organization
    engine = create_async_engine(url, poolclass=NullPool)
    first_has_number = asyncio.Event()

    async def first() -> str:
        async with AsyncSession(engine) as session:
            number = await next_claim_number(session, organization_id, 2026)
            first_has_number.set()
            await asyncio.sleep(0.3)  # still holding the counter row
            await session.commit()
            return number

    async def second() -> str:
        await first_has_number.wait()
        async with AsyncSession(engine) as session:
            number = await next_claim_number(session, organization_id, 2026)  # waits for first
            await session.commit()
            return number

    try:
        results = await asyncio.gather(first(), second())
    finally:
        await engine.dispose()

    assert list(results) == ["2026-00001", "2026-00002"]
