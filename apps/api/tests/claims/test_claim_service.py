from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID

import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.audit.models import AuditEvent
from claimforge_api.claims import service
from claimforge_api.claims.models import Claim, ClaimStatus
from claimforge_api.claims.schemas import ClaimCreate
from claimforge_api.contacts import service as contacts
from claimforge_api.contacts.models import Contact
from claimforge_api.contacts.schemas import ContactCreate
from claimforge_api.core.errors import NotFoundError, PermissionDeniedError
from claimforge_api.organizations import service as organizations
from claimforge_api.organizations.schemas import OrganizationCreate
from claimforge_api.properties import service as properties
from claimforge_api.properties.models import Property
from claimforge_api.properties.schemas import PropertyCreate
from claimforge_api.users import service as users
from claimforge_api.users.models import Membership, Role, User

NOW = datetime(2026, 11, 13, 15, 0, tzinfo=UTC)
AUSTIN = {"city": "Austin", "region": "TX", "postal_code": "78701"}


def address(line1: str = "123 Main St") -> dict[str, str]:
    return AUSTIN | {"line1": line1}


async def a_property(
    session: AsyncSession, organization_id: UUID, user: User, line1: str = "123 Main St"
) -> Property:
    data = PropertyCreate.model_validate({"address": address(line1)})
    return await properties.create_property(session, organization_id, data, user=user)


async def a_contact(
    session: AsyncSession, organization_id: UUID, user: User, name: str = "Dana Whitfield"
) -> Contact:
    data = ContactCreate(full_name=name)
    return await contacts.create_contact(session, organization_id, data, user=user)


async def create(
    session: AsyncSession,
    organization_id: UUID,
    user: User,
    now: datetime = NOW,
    **fields: Any,
) -> Claim:
    data = ClaimCreate.model_validate({"loss_type": "water"} | fields)
    return await service.create_claim(session, organization_id, data, user=user, now=now)


async def test_create_with_an_existing_property_and_contacts(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    prop = await a_property(db_session, organization_id, user)
    insured = await a_contact(db_session, organization_id, user, "Dana Whitfield")
    tenant = await a_contact(db_session, organization_id, user, "Riley Renter")

    claim = await create(
        db_session,
        organization_id,
        user,
        property_id=str(prop.id),
        loss_date="2026-11-10",
        description="Supply line burst under the kitchen sink.",
        carrier_name="Lone Star Mutual",
        carrier_claim_number="LSM-88213",
        policy_number="HO-3 551209",
        contacts=[
            {"contact_id": str(insured.id), "role": "insured", "is_primary": True},
            {"contact_id": str(tenant.id), "role": "tenant"},
        ],
    )

    assert claim.number == "2026-00001"
    assert claim.status == ClaimStatus.NEW
    assert claim.loss_date == date(2026, 11, 10)
    assert claim.created_by_id == user.id
    assert claim.property.id == prop.id
    assert [(c.contact.full_name, c.role, c.is_primary) for c in claim.contacts] == [
        ("Dana Whitfield", "insured", True),
        ("Riley Renter", "tenant", False),
    ]


async def test_numbers_increase_per_organization(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    other = await organizations.create_organization(
        db_session, OrganizationCreate(name="Other Org"), owner=user
    )

    mine = [
        (
            await create(
                db_session, organization_id, user, property={"address": address(f"{n} Elm St")}
            )
        ).number
        for n in (1, 2)
    ]
    theirs = (await create(db_session, other.id, user, property={"address": address()})).number

    assert mine == ["2026-00001", "2026-00002"]
    assert theirs == "2026-00001"


async def test_inline_property_is_created_or_reused(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    existing = await a_property(db_session, organization_id, user, "123 N Main St")

    new_place = await create(
        db_session,
        organization_id,
        user,
        property={"address": address("9 Oak Ln"), "year_built": 1971},
    )
    same_place = await create(
        db_session,
        organization_id,
        user,
        property={"address": address("123 north main street"), "year_built": 2001},
    )

    assert new_place.property.address_line1 == "9 Oak Ln"
    assert new_place.property.year_built == 1971
    assert same_place.property.id == existing.id
    # Reusing a property never overwrites its details.
    assert same_place.property.year_built is None


async def test_the_claim_year_and_today_follow_the_organizations_time_zone(
    db_session: AsyncSession, user: User
) -> None:
    # 20:00 on New Year's Eve in UTC is already New Year's Day in Kiribati (UTC+14).
    new_years_eve = datetime(2026, 12, 31, 20, 0, tzinfo=UTC)
    kiribati = await organizations.create_organization(
        db_session,
        OrganizationCreate(name="Line Islands", timezone="Pacific/Kiritimati"),
        owner=user,
    )
    utc = await organizations.create_organization(
        db_session, OrganizationCreate(name="Greenwich"), owner=user
    )

    early = await create(
        db_session,
        kiribati.id,
        user,
        new_years_eve,
        property={"address": address()},
        loss_date="2027-01-01",
    )
    assert early.number == "2027-00001"

    with pytest.raises(service.LossDateInFutureError):
        await create(
            db_session,
            utc.id,
            user,
            new_years_eve,
            property={"address": address()},
            loss_date="2027-01-01",
        )


async def test_references_must_belong_to_the_organization(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    other = await organizations.create_organization(
        db_session, OrganizationCreate(name="Other Org"), owner=user
    )
    their_property = await a_property(db_session, other.id, user)
    their_contact = await a_contact(db_session, other.id, user)
    my_old_contact = await a_contact(db_session, organization_id, user, "Gone")
    await contacts.delete_contact(db_session, organization_id, my_old_contact.id, user=user)

    with pytest.raises(service.UnknownPropertyError):
        await create(db_session, organization_id, user, property_id=str(their_property.id))
    with pytest.raises(service.UnknownContactError) as caught:
        await create(
            db_session,
            organization_id,
            user,
            property={"address": address()},
            contacts=[
                {"contact_id": str(their_contact.id), "role": "insured"},
                {"contact_id": str(my_old_contact.id), "role": "tenant"},
            ],
        )
    assert caught.value.extra == {"contact_ids": [str(their_contact.id), str(my_old_contact.id)]}
    # References are checked before anything is written, so not even the inline property exists.
    for model in (Claim, Property):
        found = await db_session.scalar(
            select(model.id).where(model.organization_id == organization_id)
        )
        assert found is None, model


@pytest.mark.parametrize(
    ("fields", "message"),
    [
        ({}, "exactly one of property_id or property"),
        (
            {
                "property_id": "01a1d4e6-5c4e-73d8-9dbc-100ca276475e",
                "property": {"address": address()},
            },
            "exactly one of property_id or property",
        ),
        (
            {
                "property": {"address": address()},
                "contacts": [
                    {"contact_id": "01a1d4e6-5c4e-73d8-9dbc-100ca276475e", "role": "insured"},
                    {"contact_id": "01a1d4e6-5c4e-73d8-9dbc-100ca276475e", "role": "tenant"},
                ],
            },
            "only once",
        ),
        (
            {
                "property": {"address": address()},
                "contacts": [
                    {
                        "contact_id": "01a1d4e6-5c4e-73d8-9dbc-100ca276475e",
                        "role": "insured",
                        "is_primary": True,
                    },
                    {
                        "contact_id": "01a1d4e6-5c4e-73d8-9dbc-100ca276475f",
                        "role": "tenant",
                        "is_primary": True,
                    },
                ],
            },
            "Only one contact can be primary",
        ),
        ({"property": {"address": address()}, "loss_type": "meteor"}, "loss_type"),
    ],
)
def test_create_rejects_inconsistent_input(fields: dict[str, Any], message: str) -> None:
    with pytest.raises(ValidationError, match=message):
        ClaimCreate.model_validate({"loss_type": "water"} | fields)


async def test_get_by_id_and_number(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    claim = await create(db_session, organization_id, user, property={"address": address()})
    other = await organizations.create_organization(
        db_session, OrganizationCreate(name="Other Org"), owner=user
    )

    assert (
        await service.get_claim(db_session, organization_id, claim.id, user=user)
    ).id == claim.id
    by_number = await service.get_claim_by_number(
        db_session, organization_id, "2026-00001", user=user
    )
    assert by_number.id == claim.id
    with pytest.raises(NotFoundError):
        await service.get_claim(db_session, other.id, claim.id, user=user)
    with pytest.raises(NotFoundError):
        await service.get_claim_by_number(db_session, organization_id, "2026-00002", user=user)


async def test_viewers_read_but_cannot_create(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    claim = await create(db_session, organization_id, user, property={"address": address()})
    viewer = await users.create_user(db_session, email="viewer@example.com", full_name="Viewer")
    db_session.add(Membership(organization_id=organization_id, user_id=viewer.id, role=Role.VIEWER))
    await db_session.commit()

    assert (
        await service.get_claim(db_session, organization_id, claim.id, user=viewer)
    ).id == claim.id
    with pytest.raises(PermissionDeniedError):
        await create(db_session, organization_id, viewer, property={"address": address("2 Elm St")})


async def test_a_property_with_claims_cannot_be_deleted(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    claim = await create(db_session, organization_id, user, property={"address": address()})

    with pytest.raises(properties.PropertyHasClaimsError, match="1 live claim"):
        await properties.delete_property(db_session, organization_id, claim.property_id, user=user)


async def test_claims_and_their_contacts_are_audited(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    insured = await a_contact(db_session, organization_id, user)
    claim = await create(
        db_session,
        organization_id,
        user,
        property={"address": address()},
        contacts=[{"contact_id": str(insured.id), "role": "insured"}],
    )

    rows = await db_session.scalars(
        select(AuditEvent)
        .where(AuditEvent.organization_id == organization_id)
        .where(AuditEvent.entity_type.in_(["claim", "claim_contact"]))
        .order_by(AuditEvent.id)
    )
    events = {e.action: e for e in rows}
    assert set(events) == {"claim.created", "claim_contact.created"}
    assert events["claim.created"].entity_id == claim.id
    assert events["claim.created"].changes["number"] == [None, "2026-00001"]
    assert events["claim_contact.created"].changes["role"] == [None, "insured"]
