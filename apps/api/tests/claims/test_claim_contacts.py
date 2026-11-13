"""Linking, re-roling and unlinking contacts on a claim."""

from uuid import UUID

import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.audit.models import AuditEvent
from claimforge_api.claims import service
from claimforge_api.claims.models import Claim
from claimforge_api.claims.models import ClaimContactRole as Role
from claimforge_api.claims.schemas import ClaimContactLink, ClaimContactLinkUpdate, ClaimCreate
from claimforge_api.contacts import service as contacts
from claimforge_api.contacts.models import Contact
from claimforge_api.contacts.schemas import ContactCreate
from claimforge_api.core.errors import NotFoundError
from claimforge_api.users.models import User

ADDRESS = {"line1": "123 Main St", "city": "Austin", "region": "TX", "postal_code": "78701"}


@pytest.fixture
async def claim(db_session: AsyncSession, organization_id: UUID, user: User) -> Claim:
    data = ClaimCreate.model_validate({"loss_type": "fire", "property": {"address": ADDRESS}})
    return await service.create_claim(db_session, organization_id, data, user=user)


async def person(db_session: AsyncSession, organization_id: UUID, user: User, name: str) -> Contact:
    return await contacts.create_contact(
        db_session, organization_id, ContactCreate(full_name=name), user=user
    )


async def roster(
    db_session: AsyncSession, organization_id: UUID, user: User, claim: Claim
) -> list[tuple[str, str, bool]]:
    fresh = await service.get_claim(db_session, organization_id, claim.id, user=user)
    return [(c.contact.full_name, c.role, c.is_primary) for c in fresh.contacts]


async def test_link_change_role_and_unlink(
    db_session: AsyncSession, organization_id: UUID, user: User, claim: Claim
) -> None:
    dana = await person(db_session, organization_id, user, "Dana")

    link = await service.link_contact(
        db_session,
        organization_id,
        claim.id,
        ClaimContactLink(contact_id=dana.id, role=Role.INSURED),
        user=user,
    )
    assert (link.contact.full_name, link.role, link.is_primary) == ("Dana", "insured", False)

    await service.update_contact_link(
        db_session,
        organization_id,
        claim.id,
        dana.id,
        ClaimContactLinkUpdate(role=Role.CO_INSURED),
        user=user,
    )
    assert await roster(db_session, organization_id, user, claim) == [("Dana", "co_insured", False)]

    await service.unlink_contact(db_session, organization_id, claim.id, dana.id, user=user)
    assert await roster(db_session, organization_id, user, claim) == []
    # The contact itself is untouched.
    assert (
        await contacts.get_contact(db_session, organization_id, dana.id, user=user)
    ).id == dana.id


async def test_promoting_a_contact_demotes_the_previous_primary(
    db_session: AsyncSession, organization_id: UUID, user: User, claim: Claim
) -> None:
    dana = await person(db_session, organization_id, user, "Dana")
    riley = await person(db_session, organization_id, user, "Riley")
    await service.link_contact(
        db_session,
        organization_id,
        claim.id,
        ClaimContactLink(contact_id=dana.id, role=Role.INSURED, is_primary=True),
        user=user,
    )

    # Linked straight in as primary...
    await service.link_contact(
        db_session,
        organization_id,
        claim.id,
        ClaimContactLink(contact_id=riley.id, role=Role.TENANT, is_primary=True),
        user=user,
    )
    assert await roster(db_session, organization_id, user, claim) == [
        ("Dana", "insured", False),
        ("Riley", "tenant", True),
    ]

    # ...or promoted later.
    await service.update_contact_link(
        db_session,
        organization_id,
        claim.id,
        dana.id,
        ClaimContactLinkUpdate(is_primary=True),
        user=user,
    )
    assert await roster(db_session, organization_id, user, claim) == [
        ("Dana", "insured", True),
        ("Riley", "tenant", False),
    ]

    # Demoting leaves the claim with no primary contact.
    await service.update_contact_link(
        db_session,
        organization_id,
        claim.id,
        dana.id,
        ClaimContactLinkUpdate(is_primary=False),
        user=user,
    )
    assert [primary for *_, primary in await roster(db_session, organization_id, user, claim)] == [
        False,
        False,
    ]


async def test_linking_twice_is_a_conflict(
    db_session: AsyncSession, organization_id: UUID, user: User, claim: Claim
) -> None:
    dana = await person(db_session, organization_id, user, "Dana")
    link = ClaimContactLink(contact_id=dana.id, role=Role.INSURED)
    await service.link_contact(db_session, organization_id, claim.id, link, user=user)

    with pytest.raises(service.ContactAlreadyLinkedError):
        await service.link_contact(db_session, organization_id, claim.id, link, user=user)


async def test_unknown_or_unlinked_contacts(
    db_session: AsyncSession, organization_id: UUID, user: User, claim: Claim
) -> None:
    stranger = await person(db_session, organization_id, user, "Stranger")
    await contacts.delete_contact(db_session, organization_id, stranger.id, user=user)
    never_linked = await person(db_session, organization_id, user, "Never Linked")

    with pytest.raises(service.UnknownContactError):
        await service.link_contact(
            db_session,
            organization_id,
            claim.id,
            ClaimContactLink(contact_id=stranger.id, role=Role.OTHER),
            user=user,
        )
    with pytest.raises(NotFoundError, match="not linked"):
        await service.unlink_contact(
            db_session, organization_id, claim.id, never_linked.id, user=user
        )


def test_an_update_must_change_something() -> None:
    with pytest.raises(ValidationError, match="Give a role, is_primary, or both"):
        ClaimContactLinkUpdate()


async def test_link_changes_are_audited(
    db_session: AsyncSession, organization_id: UUID, user: User, claim: Claim
) -> None:
    dana = await person(db_session, organization_id, user, "Dana")
    link = await service.link_contact(
        db_session,
        organization_id,
        claim.id,
        ClaimContactLink(contact_id=dana.id, role=Role.INSURED),
        user=user,
    )
    await service.unlink_contact(db_session, organization_id, claim.id, dana.id, user=user)

    rows = await db_session.scalars(
        select(AuditEvent).where(AuditEvent.entity_id == link.id).order_by(AuditEvent.id)
    )
    created, deleted = rows
    assert (created.action, deleted.action) == ("claim_contact.created", "claim_contact.deleted")
    assert deleted.changes["contact_id"] == [str(dana.id), None]
    assert deleted.changes["claim_id"] == [str(claim.id), None]
