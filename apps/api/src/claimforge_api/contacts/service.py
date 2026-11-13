"""Contact use cases. Every query is scoped to one organization the user belongs to."""

import re
from uuid import UUID

from sqlalchemy import ColumnElement, Select, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.auth.permissions import Permission, authorize
from claimforge_api.contacts.models import Contact, ContactKind, ContactMethod
from claimforge_api.contacts.schemas import ContactCreate, ContactUpdate
from claimforge_api.core.errors import BusinessRuleError, NotFoundError
from claimforge_api.db.pagination import Page, SortKey, paginate
from claimforge_api.db.search import icontains
from claimforge_api.users.models import User

ALPHABETICAL = SortKey([Contact.full_name, Contact.id])
# Searching phone numbers by fewer digits than this matches almost everything.
MIN_PHONE_DIGITS = 3


class ContactMethodUnavailableError(BusinessRuleError):
    code = "contact_method_unavailable"
    title = "Preferred contact method unavailable"


def _check_preferred_method(contact: Contact) -> None:
    """The preferred way to reach someone must be one we have details for."""
    method = contact.preferred_contact_method
    needs = "email" if method == ContactMethod.EMAIL else "phone" if method else None
    if needs and getattr(contact, needs) is None:
        raise ContactMethodUnavailableError(
            f"Add {'an email address' if needs == 'email' else 'a phone number'} "
            f"before preferring contact by {method}",
            preferred_contact_method=method,
        )


def _live_contacts(organization_id: UUID) -> Select[Contact]:
    return select(Contact).where(Contact.organization_id == organization_id, Contact.not_deleted())


def _matching(statement: Select[Contact], q: str) -> Select[Contact]:
    """Case-insensitive substring match on names and email, or on phone digits."""
    conditions: list[ColumnElement[bool]] = [
        icontains(Contact.full_name, q),
        icontains(Contact.company_name, q),
        icontains(Contact.email, q),
    ]
    digits = re.sub(r"\D", "", q)
    if len(digits) >= MIN_PHONE_DIGITS:
        conditions.append(Contact.phone.contains(digits))
    return statement.where(or_(*conditions))


async def _get_live(session: AsyncSession, organization_id: UUID, contact_id: UUID) -> Contact:
    contact = await session.scalar(_live_contacts(organization_id).where(Contact.id == contact_id))
    if contact is None:
        raise NotFoundError("Contact not found", contact_id=str(contact_id))
    return contact


async def create_contact(
    session: AsyncSession, organization_id: UUID, data: ContactCreate, *, user: User
) -> Contact:
    await authorize(session, user, organization_id, Permission.CONTACTS_WRITE)
    contact = Contact(organization_id=organization_id, **data.model_dump())
    _check_preferred_method(contact)
    session.add(contact)
    await session.commit()
    return contact


async def get_contact(
    session: AsyncSession, organization_id: UUID, contact_id: UUID, *, user: User
) -> Contact:
    await authorize(session, user, organization_id, Permission.CONTACTS_READ)
    return await _get_live(session, organization_id, contact_id)


async def list_contacts(
    session: AsyncSession,
    organization_id: UUID,
    *,
    user: User,
    kind: ContactKind | None = None,
    q: str | None = None,
    limit: int,
    cursor: str | None,
) -> Page[Contact]:
    await authorize(session, user, organization_id, Permission.CONTACTS_READ)
    statement = _live_contacts(organization_id)
    if kind is not None:
        statement = statement.where(Contact.kind == kind)
    if q and q.strip():
        statement = _matching(statement, q)
    return await paginate(session, statement, ALPHABETICAL, limit=limit, cursor=cursor)


async def update_contact(
    session: AsyncSession,
    organization_id: UUID,
    contact_id: UUID,
    data: ContactUpdate,
    *,
    user: User,
) -> Contact:
    await authorize(session, user, organization_id, Permission.CONTACTS_WRITE)
    contact = await _get_live(session, organization_id, contact_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(contact, field, value)
    _check_preferred_method(contact)
    await session.commit()
    await session.refresh(contact)
    return contact


async def delete_contact(
    session: AsyncSession, organization_id: UUID, contact_id: UUID, *, user: User
) -> None:
    await authorize(session, user, organization_id, Permission.CONTACTS_WRITE)
    contact = await _get_live(session, organization_id, contact_id)
    contact.soft_delete()
    await session.commit()
