"""Property use cases. Every query is scoped to one organization the user belongs to."""

from uuid import UUID

from sqlalchemy import Select, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.auth.permissions import Permission, authorize
from claimforge_api.claims.models import Claim
from claimforge_api.core.errors import BusinessRuleError, ConflictError, NotFoundError
from claimforge_api.db.pagination import Page, SortKey, paginate
from claimforge_api.db.search import icontains
from claimforge_api.properties.models import Property
from claimforge_api.properties.schemas import PropertyCreate, PropertyUpdate
from claimforge_api.users.models import User

NEWEST_FIRST = SortKey([Property.id], direction="desc")


class PropertyExistsError(ConflictError):
    code = "property_exists"
    title = "Property already exists"


class PropertyHasClaimsError(BusinessRuleError):
    code = "property_has_claims"
    title = "Property has claims"


def _live_properties(organization_id: UUID) -> Select[Property]:
    return select(Property).where(
        Property.organization_id == organization_id, Property.not_deleted()
    )


async def _existing_at(
    session: AsyncSession, organization_id: UUID, address_key: str
) -> UUID | None:
    return await session.scalar(
        select(Property.id).where(
            Property.organization_id == organization_id,
            Property.address_key == address_key,
            Property.not_deleted(),
        )
    )


def _exists_error(existing_id: UUID | None) -> PropertyExistsError:
    extra = {"existing_property_id": str(existing_id)} if existing_id else {}
    return PropertyExistsError("A property at this address already exists", **extra)


async def _flush(session: AsyncSession, prop: Property) -> None:
    """Flush, turning a lost race on the unique address index into a 409."""
    organization_id, address_key = prop.organization_id, prop.address_key
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        existing = await _existing_at(session, organization_id, address_key)
        raise _exists_error(existing) from exc


async def _save(session: AsyncSession, prop: Property) -> None:
    await _flush(session, prop)
    await session.commit()


def _new_property(organization_id: UUID, data: PropertyCreate) -> Property:
    prop = Property(organization_id=organization_id, **data.model_dump(exclude={"address"}))
    prop.address = data.address.to_address()
    return prop


async def _get_live(session: AsyncSession, organization_id: UUID, property_id: UUID) -> Property:
    prop = await session.scalar(_live_properties(organization_id).where(Property.id == property_id))
    if prop is None:
        raise NotFoundError("Property not found", property_id=str(property_id))
    return prop


async def create_property(
    session: AsyncSession, organization_id: UUID, data: PropertyCreate, *, user: User
) -> Property:
    await authorize(session, user, organization_id, Permission.CLAIMS_WRITE)
    address = data.address.to_address()
    if existing := await _existing_at(session, organization_id, address.key):
        raise _exists_error(existing)

    prop = _new_property(organization_id, data)
    session.add(prop)
    await _save(session, prop)
    return prop


async def find_or_add_property(
    session: AsyncSession, organization_id: UUID, data: PropertyCreate
) -> Property:
    """The live property at ``data``'s address, or a new one, without committing.

    For callers creating a property as part of a larger unit of work (a new claim at a
    new address); the caller authorizes and commits. An existing property is reused as is:
    its details are not overwritten by ``data``.
    """
    address_key = data.address.to_address().key
    existing = await session.scalar(
        _live_properties(organization_id).where(Property.address_key == address_key)
    )
    if existing is not None:
        return existing
    prop = _new_property(organization_id, data)
    session.add(prop)
    await _flush(session, prop)
    return prop


async def get_property(
    session: AsyncSession, organization_id: UUID, property_id: UUID, *, user: User
) -> Property:
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    return await _get_live(session, organization_id, property_id)


async def list_properties(
    session: AsyncSession,
    organization_id: UUID,
    *,
    user: User,
    q: str | None = None,
    postal_code: str | None = None,
    limit: int,
    cursor: str | None,
) -> Page[Property]:
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    statement = _live_properties(organization_id)
    if postal_code and postal_code.strip():
        prefix = postal_code.strip().upper()
        statement = statement.where(Property.postal_code.startswith(prefix, autoescape=True))
    if q and q.strip():
        statement = statement.where(
            or_(
                icontains(Property.address_line1, q),
                icontains(Property.address_line2, q),
                icontains(Property.city, q),
                icontains(Property.postal_code, q),
            )
        )
    return await paginate(session, statement, NEWEST_FIRST, limit=limit, cursor=cursor)


async def update_property(
    session: AsyncSession,
    organization_id: UUID,
    property_id: UUID,
    data: PropertyUpdate,
    *,
    user: User,
) -> Property:
    await authorize(session, user, organization_id, Permission.CLAIMS_WRITE)
    prop = await _get_live(session, organization_id, property_id)

    if data.address is not None:
        address = data.address.to_address()
        if address.key != prop.address_key:
            existing = await _existing_at(session, organization_id, address.key)
            if existing:
                raise _exists_error(existing)
        prop.address = address
    for field, value in data.model_dump(exclude_unset=True, exclude={"address"}).items():
        setattr(prop, field, value)

    await _save(session, prop)
    await session.refresh(prop)
    return prop


async def delete_property(
    session: AsyncSession, organization_id: UUID, property_id: UUID, *, user: User
) -> None:
    # Deleting is an admin action: a property holds the history of every claim there.
    await authorize(session, user, organization_id, Permission.CLAIMS_DELETE)
    prop = await _get_live(session, organization_id, property_id)
    open_claims = await session.scalar(
        select(func.count())
        .select_from(Claim)
        .where(Claim.property_id == prop.id, Claim.not_deleted())
    )
    if open_claims:
        raise PropertyHasClaimsError(
            f"This property has {open_claims} live claim(s) and cannot be deleted",
            claim_count=open_claims,
        )
    prop.soft_delete()
    await session.commit()
