from uuid import UUID

import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.audit.models import AuditEvent
from claimforge_api.contacts import service
from claimforge_api.contacts.models import Contact, ContactKind
from claimforge_api.contacts.schemas import ContactCreate, ContactUpdate
from claimforge_api.core.errors import NotFoundError, PermissionDeniedError
from claimforge_api.organizations import service as organizations
from claimforge_api.organizations.schemas import OrganizationCreate
from claimforge_api.users import service as users
from claimforge_api.users.models import Membership, Role, User


async def add(
    session: AsyncSession, organization_id: UUID, user: User, **fields: object
) -> Contact:
    return await service.create_contact(
        session, organization_id, ContactCreate.model_validate(fields), user=user
    )


async def names(
    session: AsyncSession,
    organization_id: UUID,
    user: User,
    *,
    kind: ContactKind | None = None,
    q: str | None = None,
) -> list[str]:
    page = await service.list_contacts(
        session, organization_id, user=user, kind=kind, q=q, limit=100, cursor=None
    )
    return [c.full_name for c in page.items]


async def test_create_normalizes_input(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    contact = await add(
        db_session,
        organization_id,
        user,
        full_name="  Dana Whitfield ",
        email="Dana.Whitfield@Example.COM",
        phone="(512) 555-0142 x12",
        company_name="",
        notes="   ",
    )

    assert contact.kind == ContactKind.POLICYHOLDER
    assert contact.full_name == "Dana Whitfield"
    assert contact.email == "dana.whitfield@example.com"
    assert contact.phone == "+15125550142;ext=12"
    assert contact.company_name is None
    assert contact.notes is None
    assert contact.created_at is not None


async def test_preferred_method_needs_matching_details(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    with pytest.raises(service.ContactMethodUnavailableError, match="phone number"):
        await add(
            db_session, organization_id, user, full_name="Sam", preferred_contact_method="text"
        )

    contact = await add(
        db_session,
        organization_id,
        user,
        full_name="Sam",
        email="sam@example.com",
        preferred_contact_method="email",
    )
    with pytest.raises(service.ContactMethodUnavailableError, match="email address"):
        await service.update_contact(
            db_session, organization_id, contact.id, ContactUpdate(email=None), user=user
        )


async def test_update_changes_and_clears_only_given_fields(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    contact = await add(
        db_session,
        organization_id,
        user,
        full_name="Lee Ortiz",
        phone="512 555 0100",
        notes="Gate code 4411",
    )

    updated = await service.update_contact(
        db_session,
        organization_id,
        contact.id,
        ContactUpdate.model_validate({"kind": "tenant", "phone": None}),
        user=user,
    )

    assert updated.kind == ContactKind.TENANT
    assert updated.phone is None
    assert updated.full_name == "Lee Ortiz"
    assert updated.notes == "Gate code 4411"


@pytest.mark.parametrize("field", ["full_name", "kind"])
def test_required_fields_cannot_be_cleared(field: str) -> None:
    with pytest.raises(ValidationError, match="cannot be cleared"):
        ContactUpdate.model_validate({field: None})


async def test_list_is_alphabetical_and_filterable(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    await add(db_session, organization_id, user, full_name="Carmen Diaz", kind="tenant")
    await add(db_session, organization_id, user, full_name="Avery Brooks")
    await add(
        db_session,
        organization_id,
        user,
        full_name="Blair Kim",
        kind="public_adjuster",
        company_name="Gulf Coast Claims",
        email="blair@gulfcoast.example",
        phone="+1 713 555 0199",
    )
    everyone = ["Avery Brooks", "Blair Kim", "Carmen Diaz"]

    assert await names(db_session, organization_id, user) == everyone
    assert await names(db_session, organization_id, user, kind=ContactKind.TENANT) == [
        "Carmen Diaz"
    ]
    for q in ("kim", "GULF", "gulfcoast.example", "713-555", "(713) 555-0199"):
        assert await names(db_session, organization_id, user, q=q) == ["Blair Kim"], q
    assert await names(db_session, organization_id, user, q="   ") == everyone


async def test_search_treats_wildcards_literally(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    await add(db_session, organization_id, user, full_name="100% Dry LLC")
    await add(db_session, organization_id, user, full_name="1000 Oaks HOA")

    assert await names(db_session, organization_id, user, q="100%") == ["100% Dry LLC"]
    assert await names(db_session, organization_id, user, q="_") == []


async def test_deleted_contacts_disappear(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    contact = await add(db_session, organization_id, user, full_name="Gone Soon")

    await service.delete_contact(db_session, organization_id, contact.id, user=user)

    assert await names(db_session, organization_id, user) == []
    with pytest.raises(NotFoundError):
        await service.get_contact(db_session, organization_id, contact.id, user=user)
    with pytest.raises(NotFoundError):
        await service.delete_contact(db_session, organization_id, contact.id, user=user)


async def test_contacts_are_scoped_to_their_organization(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    mine = await add(db_session, organization_id, user, full_name="Mine")
    other_org = await organizations.create_organization(
        db_session, OrganizationCreate(name="Other Org"), owner=user
    )
    await add(db_session, other_org.id, user, full_name="Theirs")

    assert await names(db_session, organization_id, user) == ["Mine"]
    # Right contact id, wrong organization: not found.
    with pytest.raises(NotFoundError):
        await service.get_contact(db_session, other_org.id, mine.id, user=user)


async def test_viewers_read_and_outsiders_see_nothing(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    contact = await add(db_session, organization_id, user, full_name="Dana")
    viewer = await users.create_user(db_session, email="viewer@example.com", full_name="Viewer")
    outsider = await users.create_user(db_session, email="out@example.com", full_name="Outsider")
    db_session.add(Membership(organization_id=organization_id, user_id=viewer.id, role=Role.VIEWER))
    await db_session.commit()

    found = await service.get_contact(db_session, organization_id, contact.id, user=viewer)
    assert found.id == contact.id
    with pytest.raises(PermissionDeniedError):
        await add(db_session, organization_id, viewer, full_name="Nope")
    with pytest.raises(NotFoundError):
        await service.get_contact(db_session, organization_id, contact.id, user=outsider)


async def test_changes_are_audited(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    contact = await add(db_session, organization_id, user, full_name="Dana", phone="512 555 0142")
    await service.update_contact(
        db_session, organization_id, contact.id, ContactUpdate(full_name="Dana W."), user=user
    )
    await service.delete_contact(db_session, organization_id, contact.id, user=user)

    rows = await db_session.scalars(
        select(AuditEvent).where(AuditEvent.entity_id == contact.id).order_by(AuditEvent.id)
    )
    created, updated, deleted = rows
    assert [created.action, updated.action, deleted.action] == [
        "contact.created",
        "contact.updated",
        "contact.deleted",
    ]
    assert created.organization_id == organization_id
    assert created.changes["phone"] == [None, "+15125550142"]
    assert updated.changes == {"full_name": ["Dana", "Dana W."]}
