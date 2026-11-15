"""Notes on claims: writing, mentioning, editing, deleting and finding your mentions."""

from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.audit.models import AuditEvent
from claimforge_api.claims import service as claims
from claimforge_api.claims.models import Claim
from claimforge_api.claims.schemas import ClaimCreate, ClaimStatusChangeCreate
from claimforge_api.core.errors import NotFoundError, PermissionDeniedError
from claimforge_api.notes import service
from claimforge_api.notes.models import Note, NoteMention
from claimforge_api.notes.schemas import MAX_MENTIONS, NoteCreate, NoteRead, NoteUpdate
from claimforge_api.organizations import service as organizations
from claimforge_api.organizations.schemas import OrganizationCreate
from claimforge_api.users import service as users
from claimforge_api.users.models import Membership, Role, User

ADDRESS = {"line1": "123 Main St", "city": "Austin", "region": "TX", "postal_code": "78701"}


async def new_claim(session: AsyncSession, organization_id: UUID, user: User) -> Claim:
    data = ClaimCreate.model_validate({"loss_type": "water", "property": {"address": ADDRESS}})
    return await claims.create_claim(session, organization_id, data, user=user)


@pytest.fixture
async def claim(db_session: AsyncSession, organization_id: UUID, user: User) -> Claim:
    return await new_claim(db_session, organization_id, user)


class Team:
    def __init__(self, session: AsyncSession, organization_id: UUID) -> None:
        self.session, self.organization_id = session, organization_id

    async def hire(self, role: Role, name: str) -> User:
        email = f"{name.split()[0].lower()}@example.com"
        person = await users.create_user(self.session, email=email, full_name=name)
        self.session.add(
            Membership(organization_id=self.organization_id, user_id=person.id, role=role)
        )
        await self.session.commit()
        return person

    async def write(self, by: User, claim: Claim, body: str) -> Note:
        return await service.create_note(
            self.session, self.organization_id, claim.id, NoteCreate(body=body), user=by
        )

    async def edit(self, by: User, note: Note, body: str) -> Note:
        return await service.update_note(
            self.session,
            self.organization_id,
            note.claim_id,
            note.id,
            NoteUpdate(body=body),
            user=by,
        )

    async def delete(self, by: User, note: Note) -> None:
        await service.delete_note(
            self.session, self.organization_id, note.claim_id, note.id, user=by
        )

    async def notes(self, by: User, claim: Claim, limit: int = 50) -> list[str]:
        page = await service.list_notes(
            self.session, self.organization_id, claim.id, user=by, limit=limit, cursor=None
        )
        return [n.body for n in page.items]

    async def mentioning(self, me: User) -> list[str]:
        page = await service.notes_mentioning(
            self.session, self.organization_id, user=me, limit=50, cursor=None
        )
        return [n.body for n in page.items]


@pytest.fixture
def team(db_session: AsyncSession, organization_id: UUID) -> Team:
    return Team(db_session, organization_id)


async def test_write_a_note_that_mentions_members(team: Team, user: User, claim: Claim) -> None:
    avery = await team.hire(Role.ADJUSTER, "Avery Adjuster")
    toni = await team.hire(Role.TECHNICIAN, "Toni Tech")

    note = await team.write(
        toni, claim, f"  Kitchen subfloor is wet. <@{avery.id}> can you call the carrier?  "
    )

    read = NoteRead.model_validate(note)
    assert read.body == f"Kitchen subfloor is wet. <@{avery.id}> can you call the carrier?"
    assert read.text == "Kitchen subfloor is wet. @Avery Adjuster can you call the carrier?"
    assert [m.full_name for m in read.mentions] == ["Avery Adjuster"]
    assert (read.author and read.author.full_name, read.claim.number) == ("Toni Tech", claim.number)
    assert read.edited_at is None


async def test_only_members_can_be_mentioned(
    db_session: AsyncSession, team: Team, user: User, claim: Claim
) -> None:
    stranger = await users.create_user(db_session, email="s@example.com", full_name="Stranger")
    await organizations.create_organization(
        db_session, OrganizationCreate(name="Theirs"), owner=stranger
    )
    ghost = uuid4()

    with pytest.raises(service.UnknownMentionError) as caught:
        await team.write(user, claim, f"<@{stranger.id}> <@{user.id}> <@{ghost}>")
    assert caught.value.extra["user_ids"] == [str(stranger.id), str(ghost)]

    # Text that merely looks like a mention is left alone.
    note = await team.write(user, claim, "Email <@carrier> and @Avery")
    assert note.mentions == []


async def test_each_member_is_mentioned_once(
    db_session: AsyncSession, team: Team, user: User, claim: Claim
) -> None:
    avery = await team.hire(Role.ADJUSTER, "Avery Adjuster")

    note = await team.write(user, claim, f"<@{avery.id}> ... <@{avery.id}>")

    assert [m.user_id for m in note.mentions] == [avery.id]
    assert NoteRead.model_validate(note).text == "@Avery Adjuster ... @Avery Adjuster"


def test_body_rules() -> None:
    for body in ["", "   ", "x" * 10_001]:
        with pytest.raises(ValidationError):
            NoteCreate(body=body)
    crowd = " ".join(f"<@{uuid4()}>" for _ in range(MAX_MENTIONS + 1))
    with pytest.raises(ValidationError, match="at most 20"):
        NoteCreate(body=crowd)
    with pytest.raises(ValidationError):
        NoteUpdate.model_validate({"body": "x", "pinned": True})


async def test_edit_rereads_the_mentions(
    db_session: AsyncSession, team: Team, user: User, claim: Claim
) -> None:
    avery = await team.hire(Role.ADJUSTER, "Avery Adjuster")
    blake = await team.hire(Role.ADMIN, "Blake Boss")
    toni = await team.hire(Role.TECHNICIAN, "Toni Tech")
    note = await team.write(user, claim, f"<@{avery.id}> <@{blake.id}> see photos")
    kept = next(m.id for m in note.mentions if m.user_id == avery.id)

    note = await team.edit(user, note, f"<@{avery.id}> <@{toni.id}> see photos")

    assert [m.full_name for m in note.mentioned_users] == ["Avery Adjuster", "Toni Tech"]
    # The row for a member still mentioned is kept, not replaced.
    assert next(m.id for m in note.mentions if m.user_id == avery.id) == kept
    assert note.edited_at is not None
    rows = await db_session.scalars(
        select(NoteMention.user_id).where(NoteMention.note_id == note.id)
    )
    assert set(rows) == {avery.id, toni.id}


async def test_saving_the_same_text_is_not_an_edit(team: Team, user: User, claim: Claim) -> None:
    note = await team.write(user, claim, "Dehus placed")

    note = await team.edit(user, note, "  Dehus placed ")

    assert note.edited_at is None


async def test_only_the_author_edits(team: Team, user: User, claim: Claim) -> None:
    blake = await team.hire(Role.ADMIN, "Blake Boss")
    note = await team.write(user, claim, "Mine")

    with pytest.raises(service.NotTheAuthorError):
        await team.edit(blake, note, "Not anymore")


async def test_who_may_delete(team: Team, user: User, claim: Claim) -> None:
    toni = await team.hire(Role.TECHNICIAN, "Toni Tech")
    casey = await team.hire(Role.TECHNICIAN, "Casey Crew")
    blake = await team.hire(Role.ADMIN, "Blake Boss")
    first = await team.write(toni, claim, "First")
    second = await team.write(toni, claim, "Second")

    with pytest.raises(service.NotTheAuthorError) as caught:
        await team.delete(casey, first)
    assert caught.value.extra["required_permission"] == "claims:delete"

    await team.delete(toni, first)
    await team.delete(blake, second)
    assert await team.notes(user, claim) == []
    with pytest.raises(NotFoundError, match="Note not found"):
        await team.delete(toni, first)


async def test_notes_come_newest_first_a_page_at_a_time(
    team: Team, user: User, claim: Claim
) -> None:
    for body in ["one", "two", "three"]:
        await team.write(user, claim, body)

    first = await service.list_notes(
        team.session, team.organization_id, claim.id, user=user, limit=2, cursor=None
    )
    rest = await service.list_notes(
        team.session,
        team.organization_id,
        claim.id,
        user=user,
        limit=2,
        cursor=first.next_cursor,
    )

    assert [n.body for n in first.items] == ["three", "two"]
    assert ([n.body for n in rest.items], rest.has_more) == (["one"], False)


async def test_notes_that_mention_me(
    db_session: AsyncSession, organization_id: UUID, team: Team, user: User, claim: Claim
) -> None:
    avery = await team.hire(Role.ADJUSTER, "Avery Adjuster")
    toni = await team.hire(Role.TECHNICIAN, "Toni Tech")
    other = await new_claim(db_session, organization_id, user)
    gone = await new_claim(db_session, organization_id, user)

    await team.write(user, claim, f"<@{avery.id}> first")
    await team.write(user, claim, f"<@{toni.id}> not for Avery")
    await team.write(toni, other, f"<@{avery.id}> <@{toni.id}> second")
    await team.write(user, gone, f"<@{avery.id}> on a deleted claim")
    gone.soft_delete()
    await db_session.commit()

    assert await team.mentioning(avery) == [
        f"<@{avery.id}> <@{toni.id}> second",
        f"<@{avery.id}> first",
    ]
    assert len(await team.mentioning(toni)) == 2
    assert await team.mentioning(user) == []


async def test_viewers_read_and_closed_claims_are_read_only(
    db_session: AsyncSession, organization_id: UUID, team: Team, user: User, claim: Claim
) -> None:
    viewer = await team.hire(Role.VIEWER, "Vic Viewer")
    note = await team.write(user, claim, "Before closing")

    assert await team.notes(viewer, claim) == ["Before closing"]
    with pytest.raises(PermissionDeniedError):
        await team.write(viewer, claim, "Can I?")

    await claims.change_status(
        db_session,
        organization_id,
        claim.id,
        ClaimStatusChangeCreate.model_validate({"status": "cancelled", "reason": "Duplicate"}),
        user=user,
    )
    with pytest.raises(claims.ClaimLockedError):
        await team.write(user, claim, "After closing")
    with pytest.raises(claims.ClaimLockedError):
        await team.edit(user, note, "Rewritten")


async def test_deleted_claims_and_other_claims_hide_notes(
    db_session: AsyncSession, organization_id: UUID, team: Team, user: User, claim: Claim
) -> None:
    note = await team.write(user, claim, "Here")
    other = await new_claim(db_session, organization_id, user)

    with pytest.raises(NotFoundError, match="Note not found"):
        await service.update_note(
            db_session, organization_id, other.id, note.id, NoteUpdate(body="x"), user=user
        )

    claim.soft_delete()
    await db_session.commit()
    with pytest.raises(NotFoundError, match="Claim not found"):
        await team.notes(user, claim)


async def test_notes_are_audited(
    db_session: AsyncSession, team: Team, user: User, claim: Claim
) -> None:
    note = await team.write(user, claim, "Original")
    await team.edit(user, note, "Revised")
    await team.delete(user, note)

    events = list(
        await db_session.scalars(
            select(AuditEvent).where(AuditEvent.entity_type == "note").order_by(AuditEvent.id)
        )
    )
    assert [e.action for e in events] == ["note.created", "note.updated", "note.deleted"]
    assert events[1].changes["body"] == ["Original", "Revised"]
