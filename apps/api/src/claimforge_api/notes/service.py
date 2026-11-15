"""Writing notes on claims and finding the ones that mention you.

Reading needs ``claims:read``. Writing needs ``field_data:write`` and a claim that is not
closed or cancelled. Only the author edits a note; the author or an admin (``claims:delete``)
deletes one.
"""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from claimforge_api.auth.permissions import Permission, authorize, has_permission
from claimforge_api.claims import service as claims
from claimforge_api.claims.models import Claim
from claimforge_api.core.errors import BusinessRuleError, NotFoundError, PermissionDeniedError
from claimforge_api.db.pagination import Page, SortKey, paginate
from claimforge_api.notes import mentions
from claimforge_api.notes.models import Note, NoteMention
from claimforge_api.notes.schemas import NoteCreate, NoteUpdate
from claimforge_api.users.models import Membership, User

NEWEST_FIRST = SortKey([Note.id], direction="desc")  # UUIDv7: creation order


class UnknownMentionError(BusinessRuleError):
    code = "unknown_mention"
    title = "Mentioned someone outside the organization"


class NotTheAuthorError(PermissionDeniedError):
    code = "not_note_author"
    title = "Not your note"


def _notes(organization_id: UUID) -> Select[Note]:
    """Notes with everything a note response shows, loaded up front."""
    return (
        select(Note)
        .where(Note.organization_id == organization_id)
        .options(
            selectinload(Note.claim),
            selectinload(Note.author),
            selectinload(Note.mentions).selectinload(NoteMention.user),
        )
        # Objects created earlier in this session have their relationships unloaded.
        .execution_options(populate_existing=True)
    )


async def _get_note(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, note_id: UUID
) -> Note:
    note = await session.scalar(
        _notes(organization_id).where(Note.id == note_id, Note.claim_id == claim_id)
    )
    if note is None:
        raise NotFoundError("Note not found", note_id=str(note_id))
    return note


async def _check_mentions(session: AsyncSession, organization_id: UUID, body: str) -> list[UUID]:
    """The members ``body`` mentions, or an error naming those who aren't members."""
    wanted = mentions.mentioned_ids(body)
    if not wanted:
        return []
    members = set(
        await session.scalars(
            select(Membership.user_id).where(
                Membership.organization_id == organization_id, Membership.user_id.in_(wanted)
            )
        )
    )
    unknown = [str(user_id) for user_id in wanted if user_id not in members]
    if unknown:
        raise UnknownMentionError(
            "Only members of this organization can be mentioned", user_ids=unknown
        )
    return wanted


def _mention_rows(organization_id: UUID, user_ids: list[UUID]) -> list[NoteMention]:
    return [NoteMention(organization_id=organization_id, user_id=u) for u in user_ids]


async def list_notes(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    *,
    user: User,
    limit: int,
    cursor: str | None,
) -> Page[Note]:
    """A claim's notes, newest first."""
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    await claims.require_live(session, organization_id, claim_id)
    statement = _notes(organization_id).where(Note.claim_id == claim_id)
    return await paginate(session, statement, NEWEST_FIRST, limit=limit, cursor=cursor)


async def notes_mentioning(
    session: AsyncSession, organization_id: UUID, *, user: User, limit: int, cursor: str | None
) -> Page[Note]:
    """Notes on live claims that mention ``user``, newest first."""
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    statement = (
        _notes(organization_id)
        .join(Claim, Claim.id == Note.claim_id)
        .where(Claim.not_deleted(), Note.mentions.any(NoteMention.user_id == user.id))
    )
    return await paginate(session, statement, NEWEST_FIRST, limit=limit, cursor=cursor)


async def create_note(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, data: NoteCreate, *, user: User
) -> Note:
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    mentioned = await _check_mentions(session, organization_id, data.body)
    note = Note(
        organization_id=organization_id,
        claim_id=claim_id,
        author_id=user.id,
        body=data.body,
        mentions=_mention_rows(organization_id, mentioned),
    )
    session.add(note)
    await session.commit()
    return await _get_note(session, organization_id, claim_id, note.id)


async def update_note(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    note_id: UUID,
    data: NoteUpdate,
    *,
    user: User,
) -> Note:
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    note = await _get_note(session, organization_id, claim_id, note_id)
    if note.author_id != user.id:
        raise NotTheAuthorError("Only the author can edit a note", note_id=str(note_id))
    if data.body == note.body:
        return note  # No edit, no edited_at.

    wanted = await _check_mentions(session, organization_id, data.body)
    note.body = data.body
    # A Python time, not SQL now(): the audit log only sees values it can read at flush.
    note.edited_at = datetime.now(UTC)
    # Keep the rows of members still mentioned; drop the rest, add the new ones.
    note.mentions = [m for m in note.mentions if m.user_id in wanted]
    kept = {m.user_id for m in note.mentions}
    note.mentions.extend(_mention_rows(organization_id, [u for u in wanted if u not in kept]))
    await session.commit()
    return await _get_note(session, organization_id, claim_id, note_id)


async def delete_note(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, note_id: UUID, *, user: User
) -> None:
    membership = await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    note = await _get_note(session, organization_id, claim_id, note_id)
    if note.author_id != user.id and not has_permission(membership.role, Permission.CLAIMS_DELETE):
        raise NotTheAuthorError(
            "Only the author or an admin can delete a note",
            note_id=str(note_id),
            required_permission=Permission.CLAIMS_DELETE.value,
        )
    await session.delete(note)
    await session.commit()
