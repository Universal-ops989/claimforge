import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.organizations.models import Organization
from claimforge_api.users.models import Membership, Role, User


async def make_org(session: AsyncSession, slug: str) -> Organization:
    org = Organization(name=slug.title(), slug=slug)
    session.add(org)
    await session.flush()
    return org


async def test_user_defaults(db_session: AsyncSession) -> None:
    user = User(email="ana@example.com", full_name="Ana Rivera")
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)

    assert user.is_active is True
    assert user.password_hash is None
    assert user.last_login_at is None


async def test_email_is_unique_regardless_of_case(db_session: AsyncSession) -> None:
    db_session.add(User(email="ana@example.com", full_name="Ana"))
    await db_session.flush()

    db_session.add(User(email="Ana@Example.COM", full_name="Imposter"))
    with pytest.raises(IntegrityError, match="uq_users_email_live"):
        await db_session.flush()


async def test_deleted_users_free_their_email(db_session: AsyncSession) -> None:
    old = User(email="left@example.com", full_name="Former employee")
    db_session.add(old)
    await db_session.flush()
    old.soft_delete()
    await db_session.flush()

    db_session.add(User(email="left@example.com", full_name="New hire"))
    await db_session.flush()


async def test_user_can_belong_to_several_organizations(db_session: AsyncSession) -> None:
    contractor = await make_org(db_session, "dryco")
    carrier = await make_org(db_session, "shield-insurance")
    user = User(email="ia@example.com", full_name="Independent Adjuster")
    user.memberships = [
        Membership(organization_id=contractor.id, role=Role.TECHNICIAN),
        Membership(organization_id=carrier.id, role=Role.ADJUSTER),
    ]
    db_session.add(user)
    await db_session.flush()

    roles = await db_session.execute(
        select(Organization.slug, Membership.role)
        .join(Membership, Membership.organization_id == Organization.id)
        .where(Membership.user_id == user.id)
        .order_by(Organization.slug)
    )
    assert roles.all() == [("dryco", "technician"), ("shield-insurance", "adjuster")]


async def test_one_membership_per_user_per_organization(db_session: AsyncSession) -> None:
    org = await make_org(db_session, "single-seat")
    user = User(email="dup@example.com", full_name="Dup")
    db_session.add(user)
    await db_session.flush()

    db_session.add(Membership(organization_id=org.id, user_id=user.id, role=Role.VIEWER))
    await db_session.flush()
    db_session.add(Membership(organization_id=org.id, user_id=user.id, role=Role.ADMIN))
    with pytest.raises(IntegrityError, match="uq_memberships_organization_id_user_id"):
        await db_session.flush()


async def test_database_rejects_unknown_roles(db_session: AsyncSession) -> None:
    org = await make_org(db_session, "strict-roles")
    user = User(email="role@example.com", full_name="Role")
    db_session.add(user)
    await db_session.flush()

    db_session.add(Membership(organization_id=org.id, user_id=user.id, role="superuser"))
    with pytest.raises(IntegrityError, match="ck_memberships_role_valid"):
        await db_session.flush()
