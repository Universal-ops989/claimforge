"""What reports say about a claim and how they look, gathered from the database."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from claimforge_api.claims.models import Claim, ClaimContact
from claimforge_api.core.errors import NotFoundError
from claimforge_api.reports.models import ReportKind, ReportTemplate
from claimforge_api.reports.pdf import Branding, Cover
from claimforge_api.reports.schemas import OPTIONS, TITLES
from claimforge_api.storage.base import ObjectNotFoundError, ObjectStorage
from claimforge_api.users.models import User


async def cover(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, *, prepared_by: User | None
) -> Cover:
    claim = await session.scalar(
        select(Claim)
        .where(Claim.id == claim_id, Claim.organization_id == organization_id, Claim.not_deleted())
        .options(
            selectinload(Claim.property),
            selectinload(Claim.primary_contact).selectinload(ClaimContact.contact),
        )
    )
    if claim is None:
        raise NotFoundError("Claim not found", claim_id=str(claim_id))
    extra: list[tuple[str, str]] = []
    if claim.carrier_name:
        carrier = claim.carrier_name
        if claim.carrier_claim_number:
            carrier += f" (claim {claim.carrier_claim_number})"
        extra.append(("Carrier", carrier))
    holder = claim.primary_contact.contact.full_name if claim.primary_contact else None
    return Cover(
        claim_number=claim.number,
        loss_type=str(claim.loss_type),
        loss_date=claim.loss_date,
        address=claim.property.address.formatted,
        policyholder=holder,
        prepared_at=datetime.now(UTC),
        prepared_by=prepared_by.full_name if prepared_by else None,
        extra=extra,
    )


async def branding(
    session: AsyncSession, storage: ObjectStorage, organization_id: UUID, kind: ReportKind
) -> tuple[Branding, dict[str, object]]:
    """The kind's default template as page branding, and its options (built-in if none)."""
    template = await session.scalar(
        select(ReportTemplate).where(
            ReportTemplate.organization_id == organization_id,
            ReportTemplate.kind == kind,
            ReportTemplate.is_default.is_(True),
        )
    )
    if template is None:
        return Branding(title=TITLES[kind]), OPTIONS[kind]().model_dump()
    logo = None
    if template.logo_key is not None:
        try:
            logo = await storage.get(template.logo_key)
        except ObjectNotFoundError:
            logo = None  # a report without its logo beats no report
    return (
        Branding(
            title=template.title or TITLES[kind],
            accent=template.accent_color,
            header_text=template.header_text,
            footer_text=template.footer_text,
            logo=logo,
        ),
        OPTIONS[kind].model_validate(template.options).model_dump(),
    )
