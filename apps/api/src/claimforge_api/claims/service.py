"""Claim use cases. Every query is scoped to one organization the user belongs to."""

from datetime import UTC, datetime
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from claimforge_api.auth.permissions import Permission, authorize
from claimforge_api.claims.models import Claim, ClaimContact, ClaimStatus
from claimforge_api.claims.numbering import next_claim_number
from claimforge_api.claims.schemas import ClaimCreate
from claimforge_api.contacts.models import Contact
from claimforge_api.core.errors import BusinessRuleError, NotFoundError
from claimforge_api.organizations.models import Organization
from claimforge_api.properties import service as properties
from claimforge_api.properties.models import Property
from claimforge_api.users.models import User


class UnknownPropertyError(BusinessRuleError):
    code = "unknown_property"
    title = "Unknown property"


class UnknownContactError(BusinessRuleError):
    code = "unknown_contact"
    title = "Unknown contact"


class LossDateInFutureError(BusinessRuleError):
    code = "loss_date_in_future"
    title = "Loss date in the future"


def _live_claims(organization_id: UUID) -> Select[Claim]:
    """Live claims with everything a claim response shows, loaded up front."""
    return (
        select(Claim)
        .where(Claim.organization_id == organization_id, Claim.not_deleted())
        .options(
            selectinload(Claim.property),
            selectinload(Claim.contacts).selectinload(ClaimContact.contact),
        )
        # Objects created earlier in this session have their relationships unloaded.
        .execution_options(populate_existing=True)
    )


async def _local_now(
    session: AsyncSession, organization_id: UUID, now: datetime | None
) -> datetime:
    """``now`` in the organization's time zone: claim years and "today" are local."""
    timezone = await session.scalar(
        select(Organization.timezone).where(Organization.id == organization_id)
    )
    return (now or datetime.now(UTC)).astimezone(ZoneInfo(timezone or "UTC"))


async def _resolve_property(
    session: AsyncSession, organization_id: UUID, data: ClaimCreate
) -> UUID:
    if data.property is not None:
        prop = await properties.find_or_add_property(session, organization_id, data.property)
        return prop.id
    found = await session.scalar(
        select(Property.id).where(
            Property.id == data.property_id,
            Property.organization_id == organization_id,
            Property.not_deleted(),
        )
    )
    if found is None:
        raise UnknownPropertyError(
            "No such property in this organization", property_id=str(data.property_id)
        )
    return found


async def _check_contacts(
    session: AsyncSession, organization_id: UUID, contact_ids: list[UUID]
) -> None:
    if not contact_ids:
        return
    found = set(
        await session.scalars(
            select(Contact.id).where(
                Contact.id.in_(contact_ids),
                Contact.organization_id == organization_id,
                Contact.not_deleted(),
            )
        )
    )
    missing = [str(i) for i in contact_ids if i not in found]
    if missing:
        raise UnknownContactError("No such contact(s) in this organization", contact_ids=missing)


async def create_claim(
    session: AsyncSession,
    organization_id: UUID,
    data: ClaimCreate,
    *,
    user: User,
    now: datetime | None = None,
) -> Claim:
    await authorize(session, user, organization_id, Permission.CLAIMS_WRITE)
    local_now = await _local_now(session, organization_id, now)
    if data.loss_date is not None and data.loss_date > local_now.date():
        raise LossDateInFutureError(
            f"The loss date {data.loss_date} is after today ({local_now.date()})",
            loss_date=data.loss_date.isoformat(),
        )
    await _check_contacts(session, organization_id, [c.contact_id for c in data.contacts])
    property_id = await _resolve_property(session, organization_id, data)

    # Taken last, just before the insert: the counter row stays locked until commit.
    number = await next_claim_number(session, organization_id, local_now.year)
    claim = Claim(
        organization_id=organization_id,
        number=number,
        property_id=property_id,
        status=ClaimStatus.NEW,
        created_by_id=user.id,
        **data.model_dump(exclude={"property_id", "property", "contacts"}),
    )
    session.add(claim)
    await session.flush()
    session.add_all(
        ClaimContact(
            organization_id=organization_id,
            claim_id=claim.id,
            contact_id=link.contact_id,
            role=link.role,
            is_primary=link.is_primary,
        )
        for link in data.contacts
    )
    await session.commit()
    return await _get_live(session, organization_id, claim_id=claim.id)


async def _get_live(
    session: AsyncSession,
    organization_id: UUID,
    *,
    claim_id: UUID | None = None,
    number: str | None = None,
) -> Claim:
    statement = _live_claims(organization_id)
    if claim_id is not None:
        statement = statement.where(Claim.id == claim_id)
    if number is not None:
        statement = statement.where(Claim.number == number)
    claim = await session.scalar(statement)
    if claim is None:
        reference = {"claim_id": str(claim_id)} if claim_id else {"number": number}
        raise NotFoundError("Claim not found", **reference)
    return claim


async def get_claim(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, *, user: User
) -> Claim:
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    return await _get_live(session, organization_id, claim_id=claim_id)


async def get_claim_by_number(
    session: AsyncSession, organization_id: UUID, number: str, *, user: User
) -> Claim:
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    return await _get_live(session, organization_id, number=number)
