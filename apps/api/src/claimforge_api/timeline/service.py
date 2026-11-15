"""A claim's activity, read from the audit log and told in plain words.

Anyone who can read the claim reads its timeline (``claims:read``); the raw audit log stays
behind ``audit:read``. Events are tagged with their claim when recorded, so this is one
indexed query plus batched name lookups.
"""

from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, and_, cast, not_, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.audit.models import AuditEvent
from claimforge_api.auth.permissions import Permission, authorize
from claimforge_api.claims import service as claims
from claimforge_api.claims.schemas import ClaimActor
from claimforge_api.contacts.models import Contact
from claimforge_api.db.pagination import Page, SortKey, paginate
from claimforge_api.timeline import summaries
from claimforge_api.timeline.schemas import (
    ENTITY_TYPES,
    KIND_OF,
    TimelineEntry,
    TimelineKind,
    TimelineQuery,
    TimelineSubject,
)
from claimforge_api.users.models import User

NEWEST_FIRST = SortKey([AuditEvent.id], direction="desc")


def _status_only_claim_update() -> ColumnElement[bool]:
    """A claim update that only changed status: the status change event already says it."""
    return and_(
        AuditEvent.action == "claim.updated",
        AuditEvent.changes.op("-")("status") == cast({}, JSONB),
    )


def _event(row: AuditEvent, facts: dict[UUID, dict[str, Any]]) -> summaries.Event:
    return summaries.Event(
        entity_type=row.entity_type,
        verb=row.action.rpartition(".")[2],
        changes=row.changes,
        facts=facts.get(row.entity_id, {}),
    )


async def _facts(session: AsyncSession, rows: list[AuditEvent]) -> dict[UUID, dict[str, Any]]:
    """Each record's values when it was created, from its created event."""
    ids = {r.entity_id for r in rows if r.entity_type != "claim"}
    if not ids:
        return {}
    created = await session.execute(
        select(AuditEvent.entity_id, AuditEvent.changes).where(
            AuditEvent.entity_id.in_(ids), AuditEvent.action.like("%.created")
        )
    )
    return {entity_id: {k: v[1] for k, v in changes.items()} for entity_id, changes in created}


async def _names(
    session: AsyncSession, rows: list[AuditEvent], events: list[summaries.Event]
) -> summaries.Names:
    user_ids = {r.actor_user_id for r in rows if r.actor_user_id is not None}
    contact_ids: set[UUID] = set()
    for event in events:
        user_ids |= summaries.user_ids(event)
        contact_ids |= summaries.contact_ids(event)
    users: dict[UUID, str] = {}
    if user_ids:
        found = await session.execute(select(User.id, User.full_name).where(User.id.in_(user_ids)))
        users = {user_id: full_name for user_id, full_name in found}
    contacts: dict[UUID, str] = {}
    if contact_ids:
        found = await session.execute(
            select(Contact.id, Contact.full_name).where(Contact.id.in_(contact_ids))
        )
        contacts = {contact_id: full_name for contact_id, full_name in found}
    return summaries.Names(users=users, contacts=contacts)


def _actor(user_id: UUID | None, names: summaries.Names) -> ClaimActor | None:
    if user_id is None or user_id not in names.users:
        return None
    return ClaimActor(id=user_id, full_name=names.users[user_id])


async def claim_timeline(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    query: TimelineQuery,
    *,
    user: User,
    limit: int,
    cursor: str | None,
) -> Page[TimelineEntry]:
    """Everything that happened on a live claim, newest first."""
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    await claims.require_live(session, organization_id, claim_id)
    statement = select(AuditEvent).where(
        AuditEvent.claim_id == claim_id,
        AuditEvent.organization_id == organization_id,
        not_(_status_only_claim_update()),
    )
    if query.kind:
        wanted = [entity for kind in query.kind for entity in ENTITY_TYPES.get(kind, ())]
        statement = statement.where(AuditEvent.entity_type.in_(wanted))
    page = await paginate(session, statement, NEWEST_FIRST, limit=limit, cursor=cursor)

    facts = await _facts(session, page.items)
    events = [_event(row, facts) for row in page.items]
    names = await _names(session, page.items, events)
    entries = [
        TimelineEntry(
            id=row.id,
            at=row.created_at,
            kind=KIND_OF.get(row.entity_type, TimelineKind.OTHER),
            action=row.action,
            actor=_actor(row.actor_user_id, names),
            subject=TimelineSubject(type=row.entity_type, id=row.entity_id),
            summary=summaries.summarize(event, names),
            changes=summaries.visible_changes(event),
        )
        for row, event in zip(page.items, events, strict=True)
    ]
    return Page(items=entries, next_cursor=page.next_cursor, has_more=page.has_more)
