import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.organizations.models import Organization


async def test_persists_with_defaults(db_session: AsyncSession) -> None:
    org = Organization(name="Rivera Restoration", slug="rivera-restoration")
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)

    assert org.id.version == 7
    assert org.timezone == "UTC"
    assert org.created_at is not None


@pytest.mark.parametrize("slug", ["Rivera", "rivera_restoration", "-rivera", "rivera--x", ""])
async def test_database_rejects_malformed_slugs(db_session: AsyncSession, slug: str) -> None:
    db_session.add(Organization(name="Bad", slug=slug))

    with pytest.raises(IntegrityError, match="ck_organizations_slug_format"):
        await db_session.flush()


async def test_slug_is_unique_among_live_organizations(db_session: AsyncSession) -> None:
    first = Organization(name="Acme", slug="acme")
    db_session.add(first)
    await db_session.flush()

    db_session.add(Organization(name="Acme again", slug="acme"))
    with pytest.raises(IntegrityError, match="uq_organizations_slug_live"):
        await db_session.flush()


async def test_soft_deleted_slugs_can_be_reused(db_session: AsyncSession) -> None:
    old = Organization(name="Old Acme", slug="acme-reuse")
    db_session.add(old)
    await db_session.flush()
    old.soft_delete()
    await db_session.flush()

    db_session.add(Organization(name="New Acme", slug="acme-reuse"))
    await db_session.flush()

    live = await db_session.scalars(
        select(Organization).where(Organization.slug == "acme-reuse", Organization.not_deleted())
    )
    assert [o.name for o in live] == ["New Acme"]


# The next two tests run in order: the second must not see the first one's commit.
async def test_isolation_part_1_commits_a_row(db_session: AsyncSession) -> None:
    db_session.add(Organization(name="Probe", slug="isolation-probe"))
    await db_session.commit()


async def test_isolation_part_2_does_not_see_it(db_session: AsyncSession) -> None:
    found = await db_session.scalar(
        select(Organization).where(Organization.slug == "isolation-probe")
    )
    assert found is None
