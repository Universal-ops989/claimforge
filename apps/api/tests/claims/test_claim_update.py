"""Editing a claim's details after it was created."""

from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID

import pytest
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.audit.models import AuditEvent
from claimforge_api.claims import service
from claimforge_api.claims.models import Claim, LossType
from claimforge_api.claims.schemas import ClaimCreate, ClaimUpdate
from claimforge_api.core.errors import NotFoundError, PermissionDeniedError
from claimforge_api.organizations import service as organizations
from claimforge_api.organizations.schemas import OrganizationCreate
from claimforge_api.users import service as users
from claimforge_api.users.models import Membership, Role, User

NOW = datetime(2026, 11, 13, 15, 0, tzinfo=UTC)
LONG_AGO = datetime(2020, 1, 1, tzinfo=UTC)
ADDRESS = {"line1": "123 Main St", "city": "Austin", "region": "TX", "postal_code": "78701"}


@pytest.fixture
async def claim(db_session: AsyncSession, organization_id: UUID, user: User) -> Claim:
    data = ClaimCreate.model_validate(
        {
            "loss_type": "water",
            "property": {"address": ADDRESS},
            "loss_date": "2026-11-01",
            "description": "Supply line burst under the kitchen sink",
            "carrier_name": "Lone Star Mutual",
            "policy_number": "HO3-7741",
        }
    )
    created = await service.create_claim(db_session, organization_id, data, user=user, now=NOW)
    # Every write in a test shares one transaction timestamp; backdate so a bump shows.
    created.updated_at = LONG_AGO
    await db_session.commit()
    return created


async def edit(
    db_session: AsyncSession, organization_id: UUID, user: User, claim: Claim, **fields: Any
) -> Claim:
    return await service.update_claim(
        db_session,
        organization_id,
        claim.id,
        ClaimUpdate.model_validate(fields),
        user=user,
        now=NOW,
    )


async def updates_of(db_session: AsyncSession, claim: Claim) -> list[AuditEvent]:
    rows = await db_session.scalars(
        select(AuditEvent)
        .where(AuditEvent.entity_id == claim.id, AuditEvent.action == "claim.updated")
        .order_by(AuditEvent.id)
    )
    return list(rows)


async def test_edit_sets_and_clears_only_what_is_given(
    db_session: AsyncSession, organization_id: UUID, user: User, claim: Claim
) -> None:
    edited = await edit(
        db_session,
        organization_id,
        user,
        claim,
        loss_type="fire",
        loss_date="2026-10-30",
        carrier_claim_number=" LSM-88213 ",
        description="",
        policy_number=None,
    )

    assert edited.loss_type == LossType.FIRE
    assert edited.loss_date == date(2026, 10, 30)
    assert edited.carrier_claim_number == "LSM-88213"
    assert (edited.description, edited.policy_number) == (None, None)
    # Untouched.
    assert edited.carrier_name == "Lone Star Mutual"
    assert edited.number == claim.number
    assert edited.property.address_line1 == "123 Main St"
    assert edited.updated_at > LONG_AGO

    (event,) = await updates_of(db_session, claim)
    assert event.changes == {
        "loss_type": ["water", "fire"],
        "loss_date": ["2026-11-01", "2026-10-30"],
        "carrier_claim_number": [None, "LSM-88213"],
        "description": ["Supply line burst under the kitchen sink", None],
        "policy_number": ["HO3-7741", None],
    }


@pytest.mark.parametrize(
    "fields",
    [{}, {"carrier_name": "Lone Star Mutual"}, {"loss_type": "water", "loss_date": "2026-11-01"}],
    ids=["empty", "same-value", "same-values"],
)
async def test_a_change_to_nothing_writes_nothing(
    db_session: AsyncSession,
    organization_id: UUID,
    user: User,
    claim: Claim,
    fields: dict[str, Any],
) -> None:
    edited = await edit(db_session, organization_id, user, claim, **fields)

    assert edited.updated_at == LONG_AGO
    assert await updates_of(db_session, claim) == []


async def test_the_loss_date_cannot_move_into_the_future(
    db_session: AsyncSession, organization_id: UUID, user: User, claim: Claim
) -> None:
    with pytest.raises(service.LossDateInFutureError):
        await edit(db_session, organization_id, user, claim, loss_date="2026-11-14")

    # Today is fine, and so is clearing it.
    assert (await edit(db_session, organization_id, user, claim, loss_date="2026-11-13")).loss_date
    assert (await edit(db_session, organization_id, user, claim, loss_date=None)).loss_date is None


async def test_today_follows_the_organizations_time_zone(
    db_session: AsyncSession, user: User
) -> None:
    # 20:00 UTC on 13 Nov is already 14 Nov in Kiribati (UTC+14).
    kiribati = await organizations.create_organization(
        db_session,
        OrganizationCreate(name="Line Islands", timezone="Pacific/Kiritimati"),
        owner=user,
    )
    data = ClaimCreate.model_validate({"loss_type": "wind", "property": {"address": ADDRESS}})
    claim = await service.create_claim(db_session, kiribati.id, data, user=user, now=NOW)

    edited = await service.update_claim(
        db_session,
        kiribati.id,
        claim.id,
        ClaimUpdate(loss_date=date(2026, 11, 14)),
        user=user,
        now=datetime(2026, 11, 13, 20, 0, tzinfo=UTC),
    )

    assert edited.loss_date == date(2026, 11, 14)


async def test_who_can_edit_what(
    db_session: AsyncSession, organization_id: UUID, user: User, claim: Claim
) -> None:
    viewer = await users.create_user(db_session, email="viewer@example.com", full_name="Viewer")
    db_session.add(Membership(organization_id=organization_id, user_id=viewer.id, role=Role.VIEWER))
    await db_session.commit()
    elsewhere = await organizations.create_organization(
        db_session, OrganizationCreate(name="Elsewhere"), owner=user
    )

    with pytest.raises(PermissionDeniedError):
        await edit(db_session, organization_id, viewer, claim, loss_type="fire")
    with pytest.raises(NotFoundError):  # Another organization's claim id.
        await service.update_claim(
            db_session, elsewhere.id, claim.id, ClaimUpdate(loss_type=LossType.FIRE), user=user
        )

    claim.soft_delete()
    await db_session.commit()
    with pytest.raises(NotFoundError):
        await edit(db_session, organization_id, user, claim, loss_type="fire")

    count = await db_session.scalar(
        select(func.count())
        .select_from(AuditEvent)
        .where(AuditEvent.entity_id == claim.id, AuditEvent.action == "claim.updated")
    )
    assert count == 0


@pytest.mark.parametrize(
    ("fields", "message"),
    [
        ({"loss_type": None}, "loss_type cannot be cleared"),
        ({"number": "2026-99999"}, "Extra inputs are not permitted"),
        ({"status": "closed"}, "Extra inputs are not permitted"),
        ({"property_id": "01a1d4e6-5c4e-73d8-9dbc-100ca276475e"}, "Extra inputs"),
        ({"policy_number": "x" * 65}, "at most 64 characters"),
    ],
)
def test_rejects_what_cannot_be_edited_here(fields: dict[str, Any], message: str) -> None:
    with pytest.raises(ValidationError, match=message):
        ClaimUpdate.model_validate(fields)
