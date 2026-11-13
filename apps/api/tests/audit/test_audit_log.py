from collections.abc import Iterator
from uuid import UUID

import httpx2
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.audit.models import AuditEvent
from claimforge_api.audit.recorder import REDACTED, _entity_type, actor_id_var
from claimforge_api.organizations import service as organizations
from claimforge_api.organizations.schemas import OrganizationCreate, OrganizationUpdate
from claimforge_api.users import service as users
from claimforge_api.users.models import User


@pytest.fixture
def as_actor(user: User) -> Iterator[User]:
    token = actor_id_var.set(user.id)
    yield user
    actor_id_var.reset(token)


async def events(session: AsyncSession, entity_id: UUID) -> list[AuditEvent]:
    rows = await session.scalars(
        select(AuditEvent).where(AuditEvent.entity_id == entity_id).order_by(AuditEvent.id)
    )
    return list(rows)


async def test_records_creation_with_actor_and_values(
    db_session: AsyncSession, as_actor: User
) -> None:
    org = await organizations.create_organization(
        db_session, OrganizationCreate(name="Rivera Restoration"), owner=as_actor
    )

    [created] = await events(db_session, org.id)
    assert created.action == "organization.created"
    assert created.organization_id == org.id
    assert created.actor_user_id == as_actor.id
    assert created.changes["name"] == [None, "Rivera Restoration"]
    assert "created_at" not in created.changes

    membership_events = await db_session.scalars(
        select(AuditEvent.action).where(
            AuditEvent.organization_id == org.id, AuditEvent.entity_type == "membership"
        )
    )
    assert list(membership_events) == ["membership.created"]


async def test_records_only_changed_fields_on_update(
    db_session: AsyncSession, as_actor: User
) -> None:
    org = await organizations.create_organization(
        db_session, OrganizationCreate(name="Old Name"), owner=as_actor
    )

    await organizations.update_organization(
        db_session, org.id, OrganizationUpdate(name="New Name"), user=as_actor
    )

    _created, updated = await events(db_session, org.id)
    assert updated.action == "organization.updated"
    assert updated.changes == {"name": ["Old Name", "New Name"]}


async def test_soft_delete_is_recorded_as_deleted(db_session: AsyncSession, as_actor: User) -> None:
    org = await organizations.create_organization(
        db_session, OrganizationCreate(name="Short Lived"), owner=as_actor
    )

    await organizations.delete_organization(db_session, org.id, user=as_actor)

    assert [e.action for e in await events(db_session, org.id)] == [
        "organization.created",
        "organization.deleted",
    ]


async def test_secrets_are_redacted(db_session: AsyncSession) -> None:
    created = await users.create_user(
        db_session, email="secret@example.com", full_name="S", password="tile grout and drywall"
    )

    [event] = await events(db_session, created.id)
    assert event.changes["password_hash"] == [None, REDACTED]
    assert event.organization_id is None


async def test_rolled_back_changes_leave_no_audit_rows(db_session: AsyncSession) -> None:
    async with db_session.begin_nested():
        ghost = User(email="ghost@example.com", full_name="Ghost")
        db_session.add(ghost)
        await db_session.flush()
        ghost_id = ghost.id
        assert await events(db_session, ghost_id)  # written in the same transaction...
        await db_session.rollback()

    assert await events(db_session, ghost_id) == []  # ...and rolled back with it


async def test_api_changes_carry_actor_and_request_id(
    auth_client: httpx2.AsyncClient, db_session: AsyncSession, user: User
) -> None:
    response = await auth_client.post(
        "/v1/organizations", json={"name": "Traced Org"}, headers={"X-Request-ID": "trace-77"}
    )

    [event] = await events(db_session, UUID(response.json()["id"]))
    assert event.actor_user_id == user.id
    assert event.request_id == "trace-77"
    assert actor_id_var.get() is None  # reset after the request


def test_entity_names_come_from_the_table_or_an_explicit_name() -> None:
    class Plain:
        __tablename__ = "contacts"

    class Irregular:
        __tablename__ = "properties"
        __audit_entity__ = "property"

    assert _entity_type(Plain()) == "contact"
    assert _entity_type(Irregular()) == "property"
