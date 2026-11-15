"""Audit events tagged with their claim, and the migration that tagged the old ones."""

import importlib.util
from pathlib import Path
from types import ModuleType
from typing import Any
from uuid import UUID

import pytest
from sqlalchemy import delete, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.audit.models import AuditEvent
from claimforge_api.claims import service as claims
from claimforge_api.claims.models import Claim
from claimforge_api.claims.schemas import ClaimCreate, ClaimStatusChangeCreate
from claimforge_api.contacts import service as contacts
from claimforge_api.contacts.schemas import ContactCreate
from claimforge_api.notes import service as notes
from claimforge_api.notes.schemas import NoteCreate, NoteUpdate
from claimforge_api.tasks import service as tasks
from claimforge_api.tasks.schemas import TaskCreate, TaskUpdate
from claimforge_api.users.models import User

ADDRESS = {"line1": "123 Main St", "city": "Austin", "region": "TX", "postal_code": "78701"}
MIGRATION = next(
    (Path(__file__).parents[2] / "migrations" / "versions").glob("*_14f26ad51f61_*.py")
)


def load_migration() -> ModuleType:
    spec = importlib.util.spec_from_file_location("claim_id_migration", MIGRATION)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


async def busy_claim(session: AsyncSession, organization_id: UUID, user: User) -> Claim:
    """A claim with a little of everything: an edited note, a deleted task, a status change."""
    data = ClaimCreate.model_validate({"loss_type": "water", "property": {"address": ADDRESS}})
    claim = await claims.create_claim(session, organization_id, data, user=user)
    note = await notes.create_note(
        session, organization_id, claim.id, NoteCreate(body="First look"), user=user
    )
    await notes.update_note(
        session, organization_id, claim.id, note.id, NoteUpdate(body="Second look"), user=user
    )
    task = await tasks.create_task(
        session, organization_id, claim.id, TaskCreate(title="Call carrier"), user=user
    )
    await tasks.delete_task(session, organization_id, claim.id, task.id, user=user)
    await claims.change_status(
        session,
        organization_id,
        claim.id,
        ClaimStatusChangeCreate.model_validate({"status": "on_hold", "reason": "Waiting on PA"}),
        user=user,
    )
    return claim


async def claim_events(session: AsyncSession, claim_id: UUID) -> list[AuditEvent]:
    rows = await session.scalars(
        select(AuditEvent).where(AuditEvent.claim_id == claim_id).order_by(AuditEvent.id)
    )
    return list(rows)


async def test_events_under_a_claim_carry_its_id(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    claim = await busy_claim(db_session, organization_id, user)
    contact = await contacts.create_contact(
        db_session, organization_id, ContactCreate(full_name="Dana"), user=user
    )

    actions = [e.action for e in await claim_events(db_session, claim.id)]

    assert actions[:5] == [
        "claim.created",
        "note.created",
        "note.updated",
        "task.created",
        "task.deleted",
    ]
    # The status history row and the claim's status column change in one flush, which
    # doesn't order its events.
    assert sorted(actions[5:]) == ["claim.updated", "claim_status_change.created"]
    outside = await db_session.scalar(select(AuditEvent).where(AuditEvent.entity_id == contact.id))
    assert outside is not None
    assert outside.claim_id is None


async def test_status_changes_are_audited_with_their_reason(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    claim = await busy_claim(db_session, organization_id, user)

    change = await db_session.scalar(
        select(AuditEvent).where(
            AuditEvent.claim_id == claim.id, AuditEvent.entity_type == "claim_status_change"
        )
    )

    assert change is not None
    assert change.changes["from_status"] == [None, "new"]
    assert change.changes["to_status"] == [None, "on_hold"]
    assert change.changes["reason"] == [None, "Waiting on PA"]


@pytest.fixture
def backfill() -> tuple[str, ...]:
    statements: tuple[str, ...] = load_migration().BACKFILL
    return statements


async def test_the_migration_tags_existing_events(
    db_session: AsyncSession, organization_id: UUID, user: User, backfill: tuple[str, ...]
) -> None:
    # Plain ids: expire_all() below would otherwise make these objects reload lazily.
    claim_id = (await busy_claim(db_session, organization_id, user)).id
    user_id = user.id
    recorded = await claim_events(db_session, claim_id)
    expected_tags = {e.id: e.claim_id for e in recorded if e.entity_type != "claim_status_change"}
    [status_event] = [e for e in recorded if e.entity_type == "claim_status_change"]
    expected_status: dict[str, Any] = {
        "action": status_event.action,
        "entity_id": status_event.entity_id,
        "changes": status_event.changes,
    }

    # Back to how the log looked before this change: untagged, no status events.
    await db_session.execute(
        delete(AuditEvent).where(AuditEvent.entity_type == "claim_status_change")
    )
    await db_session.execute(update(AuditEvent).values(claim_id=None))
    for statement in backfill:
        await db_session.execute(text(statement))
    db_session.expire_all()

    rebuilt = await claim_events(db_session, claim_id)
    assert {e.id: e.claim_id for e in rebuilt if e.id in expected_tags} == expected_tags
    [status_rebuilt] = [e for e in rebuilt if e.entity_type == "claim_status_change"]
    assert {
        "action": status_rebuilt.action,
        "entity_id": status_rebuilt.entity_id,
        "changes": status_rebuilt.changes,
    } == expected_status
    # Rebuilt status events carry who made the change (live ones get it from the request).
    assert status_rebuilt.actor_user_id == user_id

    # Running it again adds nothing.
    for statement in backfill:
        await db_session.execute(text(statement))
    assert len(await claim_events(db_session, claim_id)) == len(rebuilt)


async def test_completion_and_edit_times_are_audited(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    # Setting a column to SQL now() expires it at flush, before the recorder can read it;
    # services set these times in Python so the log keeps them.
    claim_id = (await busy_claim(db_session, organization_id, user)).id
    task = await tasks.create_task(
        db_session, organization_id, claim_id, TaskCreate(title="Set dehus"), user=user
    )
    await tasks.update_task(
        db_session, organization_id, claim_id, task.id, TaskUpdate(done=True), user=user
    )

    updates = {
        e.entity_type: e.changes
        for e in await claim_events(db_session, claim_id)
        if e.action in {"task.updated", "note.updated"}
    }

    assert updates["task"]["completed_at"][0] is None
    assert updates["task"]["completed_at"][1] is not None
    assert updates["note"]["edited_at"][1] is not None
