"""Organization use cases. Route handlers stay thin and delegate here."""

import re
import unicodedata
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.core.errors import ConflictError, NotFoundError
from claimforge_api.db.pagination import Page, SortKey, paginate
from claimforge_api.organizations.models import Organization
from claimforge_api.organizations.schemas import OrganizationCreate, OrganizationUpdate
from claimforge_api.users.models import Membership, Role, User

SLUG_MAX = 63
NEWEST_FIRST = SortKey([Organization.id], direction="desc")


class SlugTakenError(ConflictError):
    code = "slug_taken"
    title = "Slug already in use"


def slugify(name: str) -> str:
    """'Rivera & Sons Restoration, LLC' -> 'rivera-sons-restoration-llc'."""
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")
    return slug[:SLUG_MAX].rstrip("-") or "organization"


async def _slug_in_use(session: AsyncSession, slug: str) -> bool:
    found = await session.scalar(
        select(Organization.id).where(Organization.slug == slug, Organization.not_deleted())
    )
    return found is not None


async def _available_slug(session: AsyncSession, base: str) -> str:
    """``base``, or ``base-2``, ``base-3``… if taken."""
    candidate, n = base, 1
    while await _slug_in_use(session, candidate):
        n += 1
        suffix = f"-{n}"
        candidate = base[: SLUG_MAX - len(suffix)].rstrip("-") + suffix
    return candidate


async def create_organization(
    session: AsyncSession, data: OrganizationCreate, *, owner: User
) -> Organization:
    """Create an organization with ``owner`` as its first member (role: owner)."""
    if data.slug is not None:
        if await _slug_in_use(session, data.slug):
            raise SlugTakenError(f"The slug '{data.slug}' is already in use", slug=data.slug)
        slug = data.slug
    else:
        slug = await _available_slug(session, slugify(data.name))

    organization = Organization(name=data.name, slug=slug, timezone=data.timezone)
    session.add(organization)
    try:
        await session.flush()
        session.add(Membership(organization_id=organization.id, user_id=owner.id, role=Role.OWNER))
        await session.flush()
    except IntegrityError as exc:
        # Another request claimed the slug between our check and insert.
        await session.rollback()
        raise SlugTakenError(f"The slug '{slug}' is already in use", slug=slug) from exc
    await session.commit()
    return organization


def _member_organizations(user: User) -> Select[Organization]:
    """Live organizations the user belongs to. Every read and write goes through this."""
    return (
        select(Organization)
        .join(Membership, Membership.organization_id == Organization.id)
        .where(Membership.user_id == user.id, Organization.not_deleted())
    )


async def get_organization(
    session: AsyncSession, organization_id: UUID, *, user: User
) -> Organization:
    """The organization if ``user`` is a member; otherwise 404 (never reveal it exists)."""
    organization = await session.scalar(
        _member_organizations(user).where(Organization.id == organization_id)
    )
    if organization is None:
        raise NotFoundError("Organization not found", organization_id=str(organization_id))
    return organization


async def list_organizations(
    session: AsyncSession, *, user: User, limit: int, cursor: str | None
) -> Page[Organization]:
    return await paginate(
        session, _member_organizations(user), NEWEST_FIRST, limit=limit, cursor=cursor
    )


async def update_organization(
    session: AsyncSession, organization_id: UUID, data: OrganizationUpdate, *, user: User
) -> Organization:
    organization = await get_organization(session, organization_id, user=user)
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(organization, field, value)
    await session.commit()
    await session.refresh(organization)
    return organization


async def delete_organization(session: AsyncSession, organization_id: UUID, *, user: User) -> None:
    organization = await get_organization(session, organization_id, user=user)
    organization.soft_delete()
    await session.commit()
