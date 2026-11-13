"""Moving claims through the status workflow, and the history it leaves behind."""

import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any
from uuid import UUID

import pytest
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from claimforge_api.audit.models import AuditEvent
from claimforge_api.claims import service
from claimforge_api.claims.models import Claim, ClaimContactRole, ClaimStatus
from claimforge_api.claims.schemas import (
    ClaimContactLink,
    ClaimContactLinkUpdate,
    ClaimCreate,
    ClaimStatusChangeCreate,
    ClaimUpdate,
)
from claimforge_api.contacts import service as contacts
from claimforge_api.contacts.schemas import ContactCreate
from claimforge_api.core.errors import NotFoundError, PermissionDeniedError
from claimforge_api.organizations import service as organizations
from claimforge_api.organizations.models import Organization
from claimforge_api.organizations.schemas import OrganizationCreate
from claimforge_api.users import service as users
from claimforge_api.users.models import Membership, Role, User

ADDRESS = {"line1": "123 Main St", "city": "Austin", "region": "TX", "postal_code": "78701"}


async def new_claim(session: AsyncSession, organization_id: UUID, user: User) -> Claim:
    data = ClaimCreate.model_validate({"loss_type": "water", "property": {"address": ADDRESS}})
    return await service.create_claim(session, organization_id, data, user=user)


@pytest.fixture
async def claim(db_session: AsyncSession, organization_id: UUID, user: User) -> Claim:
    return await new_claim(db_session, organization_id, user)


@pytest.fixture
async def adjuster(db_session: AsyncSession, organization_id: UUID) -> User:
    person = await users.create_user(db_session, email="adj@example.com", full_name="Avery Adj")
    db_session.add(
        Membership(organization_id=organization_id, user_id=person.id, role=Role.ADJUSTER)
    )
    await db_session.commit()
    return person


async def move(
    session: AsyncSession, organization_id: UUID, user: User, claim: Claim, **fields: Any
) -> Claim:
    return await service.change_status(
        session,
        organization_id,
        claim.id,
        ClaimStatusChangeCreate.model_validate(fields),
        user=user,
    )


async def test_a_claim_lives_its_life_and_keeps_a_history(
    db_session: AsyncSession, organization_id: UUID, user: User, adjuster: User, claim: Claim
) -> None:
    for status, reason in [
        ("inspected", None),
        ("in_progress", None),
        ("on_hold", "Waiting on the carrier to approve drying"),
        ("in_progress", None),
        ("completed", None),
        ("closed", None),
    ]:
        moved = await move(
            db_session, organization_id, adjuster, claim, status=status, reason=reason
        )
        assert moved.status == status
    await move(db_session, organization_id, user, claim, status="in_progress", reason="Supplement")

    history = await service.status_history(db_session, organization_id, claim.id, user=adjuster)

    assert [(h.from_status, h.to_status) for h in history] == [
        ("new", "inspected"),
        ("inspected", "in_progress"),
        ("in_progress", "on_hold"),
        ("on_hold", "in_progress"),
        ("in_progress", "completed"),
        ("completed", "closed"),
        ("closed", "in_progress"),
    ]
    assert history[2].reason == "Waiting on the carrier to approve drying"
    assert [h.changed_by.full_name for h in history if h.changed_by][-2:] == [
        "Avery Adj",
        "Morgan Member",
    ]


async def test_moves_outside_the_workflow_are_refused(
    db_session: AsyncSession, organization_id: UUID, user: User, claim: Claim
) -> None:
    with pytest.raises(service.InvalidStatusTransitionError) as caught:
        await move(db_session, organization_id, user, claim, status="closed")

    assert caught.value.extra["allowed"] == ["inspected", "in_progress", "on_hold", "cancelled"]
    with pytest.raises(service.InvalidStatusTransitionError):
        await move(db_session, organization_id, user, claim, status="new")  # already new
    assert await service.status_history(db_session, organization_id, claim.id, user=user) == []


@pytest.mark.parametrize("reason", [None, "", "   "])
async def test_holding_or_cancelling_needs_a_reason(
    db_session: AsyncSession, organization_id: UUID, user: User, claim: Claim, reason: str | None
) -> None:
    for status in ("on_hold", "cancelled"):
        with pytest.raises(service.ReasonRequiredError):
            await move(db_session, organization_id, user, claim, status=status, reason=reason)

    cancelled = await move(
        db_session, organization_id, user, claim, status="cancelled", reason="Duplicate of 00007"
    )
    assert cancelled.status == ClaimStatus.CANCELLED


async def test_only_supervisors_reopen_or_reinstate(
    db_session: AsyncSession, organization_id: UUID, user: User, adjuster: User, claim: Claim
) -> None:
    await move(db_session, organization_id, adjuster, claim, status="cancelled", reason="Dupe")

    with pytest.raises(PermissionDeniedError) as caught:
        await move(db_session, organization_id, adjuster, claim, status="new", reason="Not a dupe")
    assert caught.value.extra["required_permission"] == "claims:reopen"
    with pytest.raises(service.ReasonRequiredError):
        await move(db_session, organization_id, user, claim, status="new")

    reinstated = await move(db_session, organization_id, user, claim, status="new", reason="Real")
    assert reinstated.status == ClaimStatus.NEW


async def test_expected_status_catches_a_stale_view(
    db_session: AsyncSession, organization_id: UUID, user: User, claim: Claim
) -> None:
    await move(db_session, organization_id, user, claim, status="inspected", expected_status="new")

    # A second click on the same "Inspected" button, from a screen still showing "new".
    with pytest.raises(service.StatusChangedError) as caught:
        await move(
            db_session, organization_id, user, claim, status="in_progress", expected_status="new"
        )
    assert caught.value.extra["current_status"] == "inspected"


async def test_viewers_cannot_change_status_and_others_cannot_see_the_claim(
    db_session: AsyncSession, organization_id: UUID, user: User, claim: Claim
) -> None:
    viewer = await users.create_user(db_session, email="view@example.com", full_name="Viewer")
    db_session.add(Membership(organization_id=organization_id, user_id=viewer.id, role=Role.VIEWER))
    await db_session.commit()
    elsewhere = await organizations.create_organization(
        db_session, OrganizationCreate(name="Elsewhere"), owner=user
    )

    with pytest.raises(PermissionDeniedError):
        await move(db_session, organization_id, viewer, claim, status="inspected")
    with pytest.raises(NotFoundError):
        await move(db_session, elsewhere.id, user, claim, status="inspected")
    with pytest.raises(NotFoundError):
        await service.status_history(db_session, elsewhere.id, claim.id, user=user)

    claim.soft_delete()
    await db_session.commit()
    with pytest.raises(NotFoundError):
        await move(db_session, organization_id, user, claim, status="inspected")


async def test_the_status_change_is_audited_on_the_claim(
    db_session: AsyncSession, organization_id: UUID, user: User, claim: Claim
) -> None:
    await move(db_session, organization_id, user, claim, status="inspected")

    event = await db_session.scalar(
        select(AuditEvent).where(
            AuditEvent.entity_id == claim.id, AuditEvent.action == "claim.updated"
        )
    )
    assert event is not None
    assert event.changes["status"] == ["new", "inspected"]


@pytest.mark.parametrize(
    ("final", "path"),
    [
        ("closed", [("in_progress", None), ("completed", None), ("closed", None)]),
        ("cancelled", [("cancelled", "Duplicate")]),
    ],
)
async def test_closed_and_cancelled_claims_are_read_only(
    db_session: AsyncSession,
    organization_id: UUID,
    user: User,
    claim: Claim,
    final: str,
    path: list[tuple[str, str | None]],
) -> None:
    dana = await contacts.create_contact(
        db_session, organization_id, ContactCreate(full_name="Dana"), user=user
    )
    riley = await contacts.create_contact(
        db_session, organization_id, ContactCreate(full_name="Riley"), user=user
    )
    link = ClaimContactLink(contact_id=dana.id, role=ClaimContactRole.INSURED)
    await service.link_contact(db_session, organization_id, claim.id, link, user=user)
    for status, reason in path:
        await move(db_session, organization_id, user, claim, status=status, reason=reason)

    attempts = [
        service.update_claim(
            db_session, organization_id, claim.id, ClaimUpdate(description="x"), user=user
        ),
        service.link_contact(
            db_session,
            organization_id,
            claim.id,
            ClaimContactLink(contact_id=riley.id, role=ClaimContactRole.TENANT),
            user=user,
        ),
        service.update_contact_link(
            db_session,
            organization_id,
            claim.id,
            dana.id,
            ClaimContactLinkUpdate(is_primary=True),
            user=user,
        ),
        service.unlink_contact(db_session, organization_id, claim.id, dana.id, user=user),
    ]
    for attempt in attempts:
        with pytest.raises(service.ClaimLockedError) as caught:
            await attempt
        assert caught.value.extra["claim_status"] == final

    # Reading still works, and reopening or reinstating unlocks it.
    assert (await service.get_claim(db_session, organization_id, claim.id, user=user)).contacts
    back = "in_progress" if final == "closed" else "new"
    await move(db_session, organization_id, user, claim, status=back, reason="More to do")
    edited = await service.update_claim(
        db_session, organization_id, claim.id, ClaimUpdate(description="x"), user=user
    )
    assert edited.description == "x"


# ─── Concurrency ──────────────────────────────────────────────────────────────


@dataclass
class Committed:
    url: str
    organization_id: UUID
    user: User
    claim_id: UUID


@pytest.fixture
async def committed(migrated_database_url: str) -> AsyncIterator[Committed]:
    """A real, committed claim, for tests that need several connections."""
    engine = create_async_engine(migrated_database_url, poolclass=NullPool)
    async with AsyncSession(engine, expire_on_commit=False) as session:
        owner = await users.create_user(session, email="race@example.com", full_name="Racer")
        org = await organizations.create_organization(
            session, OrganizationCreate(name="Race Co"), owner=owner
        )
        claim = await new_claim(session, org.id, owner)
    yield Committed(migrated_database_url, org.id, owner, claim.id)
    async with engine.begin() as connection:
        await connection.execute(delete(Organization).where(Organization.id == org.id))
        await connection.execute(delete(User).where(User.id == owner.id))
    await engine.dispose()


async def test_concurrent_changes_queue_up_on_the_claim(committed: Committed) -> None:
    engine = create_async_engine(committed.url, poolclass=NullPool)
    holding = asyncio.Event()

    async def someone_else_moves_it() -> None:
        # Another request mid-change: row locked, new status not yet committed.
        async with AsyncSession(engine) as session:
            claim = await session.scalar(
                select(Claim).where(Claim.id == committed.claim_id).with_for_update()
            )
            assert claim is not None
            claim.status = ClaimStatus.IN_PROGRESS
            await session.flush()
            holding.set()
            await asyncio.sleep(0.3)
            await session.commit()

    async def we_cancel_from_new() -> None:
        await holding.wait()
        async with AsyncSession(engine, expire_on_commit=False) as session:
            # Waits for the other change, then sees in_progress, not the "new" it expected.
            await service.change_status(
                session,
                committed.organization_id,
                committed.claim_id,
                ClaimStatusChangeCreate(
                    status=ClaimStatus.CANCELLED, reason="Dupe", expected_status=ClaimStatus.NEW
                ),
                user=committed.user,
            )

    try:
        results = await asyncio.gather(
            someone_else_moves_it(), we_cancel_from_new(), return_exceptions=True
        )
    finally:
        await engine.dispose()

    assert results[0] is None
    assert isinstance(results[1], service.StatusChangedError)
