"""Claim use cases. Every query is scoped to one organization the user belongs to."""

from datetime import UTC, date, datetime
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import ColumnElement, Select, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from claimforge_api.auth.permissions import Permission, authorize, has_permission
from claimforge_api.claims import workflow
from claimforge_api.claims.models import (
    AssignmentRole,
    Claim,
    ClaimAssignment,
    ClaimContact,
    ClaimStatus,
    ClaimStatusChange,
)
from claimforge_api.claims.numbering import next_claim_number
from claimforge_api.claims.schemas import (
    ClaimAssignmentCreate,
    ClaimContactLink,
    ClaimContactLinkUpdate,
    ClaimCreate,
    ClaimListQuery,
    ClaimSort,
    ClaimStatusChangeCreate,
    ClaimUpdate,
)
from claimforge_api.contacts.models import Contact
from claimforge_api.core.errors import BusinessRuleError, ConflictError, NotFoundError
from claimforge_api.db.pagination import Page, SortKey, paginate
from claimforge_api.db.search import icontains
from claimforge_api.organizations.models import Organization
from claimforge_api.properties import service as properties
from claimforge_api.properties.models import Property
from claimforge_api.users.models import Membership, User


class UnknownPropertyError(BusinessRuleError):
    code = "unknown_property"
    title = "Unknown property"


class UnknownContactError(BusinessRuleError):
    code = "unknown_contact"
    title = "Unknown contact"


class ContactAlreadyLinkedError(ConflictError):
    code = "contact_already_linked"
    title = "Contact already linked"


class LossDateInFutureError(BusinessRuleError):
    code = "loss_date_in_future"
    title = "Loss date in the future"


class InvalidStatusTransitionError(BusinessRuleError):
    code = "invalid_status_transition"
    title = "Status change not allowed"


class ReasonRequiredError(BusinessRuleError):
    code = "reason_required"
    title = "Reason required"


class StatusChangedError(ConflictError):
    code = "status_changed"
    title = "Status changed"


class ClaimLockedError(ConflictError):
    code = "claim_locked"
    title = "Claim is closed"


class UnknownAssigneeError(BusinessRuleError):
    code = "unknown_assignee"
    title = "Not a member"


class AssigneeLacksPermissionError(BusinessRuleError):
    code = "assignee_lacks_permission"
    title = "Member can't take this role"


class AlreadyAssignedError(ConflictError):
    code = "already_assigned"
    title = "Already assigned"


def _live_claims(organization_id: UUID) -> Select[Claim]:
    """Live claims with everything a claim response shows, loaded up front."""
    return (
        select(Claim)
        .where(Claim.organization_id == organization_id, Claim.not_deleted())
        .options(
            selectinload(Claim.property),
            selectinload(Claim.contacts).selectinload(ClaimContact.contact),
            selectinload(Claim.assignments).selectinload(ClaimAssignment.user),
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


def _check_loss_date(loss_date: date | None, local_now: datetime) -> None:
    if loss_date is not None and loss_date > local_now.date():
        raise LossDateInFutureError(
            f"The loss date {loss_date} is after today ({local_now.date()})",
            loss_date=loss_date.isoformat(),
        )


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
    _check_loss_date(data.loss_date, local_now)
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


async def update_claim(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    data: ClaimUpdate,
    *,
    user: User,
    now: datetime | None = None,
) -> Claim:
    await authorize(session, user, organization_id, Permission.CLAIMS_WRITE)
    claim = await _get_editable(session, organization_id, claim_id)
    changes = data.model_dump(exclude_unset=True)
    if "loss_date" in changes:
        _check_loss_date(data.loss_date, await _local_now(session, organization_id, now))
    for field, value in changes.items():
        setattr(claim, field, value)
    # Unchanged values leave no history, so a no-op writes neither a row nor an audit event.
    await session.commit()
    # Reload for the database's new updated_at.
    return await _get_live(session, organization_id, claim_id=claim_id)


# ─── Status ───────────────────────────────────────────────────────────────────


async def _lock_status(session: AsyncSession, organization_id: UUID, claim_id: UUID) -> str:
    """The claim's current status, with its row locked until commit.

    Concurrent changes to one claim queue up here, so each one sees the status the
    previous one left behind instead of both acting on the same starting point.
    """
    current = await session.scalar(
        select(Claim.status)
        .where(
            Claim.id == claim_id,
            Claim.organization_id == organization_id,
            Claim.not_deleted(),
        )
        .with_for_update()
    )
    if current is None:
        raise NotFoundError("Claim not found", claim_id=str(claim_id))
    return current


async def lock_for_changes(session: AsyncSession, organization_id: UUID, claim_id: UUID) -> None:
    """Lock a live claim against concurrent changes, refusing if it is closed or cancelled.

    Anything that changes a claim or a record under it (contacts, assignments, rooms) calls
    this first. Writers to one claim then take turns, so checks such as "is this name free"
    stay true until commit, and nothing slips in while the claim is being closed.
    """
    current = await _lock_status(session, organization_id, claim_id)
    if current in workflow.FINAL:
        action = "Reinstate" if current == ClaimStatus.CANCELLED else "Reopen"
        raise ClaimLockedError(
            f"The claim is {current}. {action} it to make changes.", claim_status=current
        )


async def require_live(session: AsyncSession, organization_id: UUID, claim_id: UUID) -> None:
    """404 unless the claim exists in the organization and is not deleted."""
    found = await session.scalar(
        select(Claim.id).where(
            Claim.id == claim_id, Claim.organization_id == organization_id, Claim.not_deleted()
        )
    )
    if found is None:
        raise NotFoundError("Claim not found", claim_id=str(claim_id))


async def _get_editable(session: AsyncSession, organization_id: UUID, claim_id: UUID) -> Claim:
    """The claim, locked against concurrent changes, if it is not closed or cancelled."""
    await lock_for_changes(session, organization_id, claim_id)
    return await _get_live(session, organization_id, claim_id=claim_id)


async def change_status(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    data: ClaimStatusChangeCreate,
    *,
    user: User,
) -> Claim:
    await authorize(session, user, organization_id, Permission.CLAIMS_WRITE)
    current = ClaimStatus(await _lock_status(session, organization_id, claim_id))
    target = data.status

    if data.expected_status is not None and data.expected_status != current:
        raise StatusChangedError(
            f"The claim is {current} now, not {data.expected_status}",
            current_status=current.value,
        )
    if not workflow.is_allowed(current, target):
        raise InvalidStatusTransitionError(
            f"A claim that is {current} cannot become {target}",
            from_status=current.value,
            to_status=target.value,
            allowed=[s.value for s in workflow.next_statuses(current)],
        )
    needed = workflow.required_permission(current)
    if needed is not Permission.CLAIMS_WRITE:
        await authorize(session, user, organization_id, needed)
    if workflow.needs_reason(current, target) and not data.reason:
        raise ReasonRequiredError(
            f"Say why the claim goes from {current} to {target}",
            from_status=current.value,
            to_status=target.value,
        )

    claim = await _get_live(session, organization_id, claim_id=claim_id)
    claim.status = target
    session.add(
        ClaimStatusChange(
            organization_id=organization_id,
            claim_id=claim_id,
            from_status=current,
            to_status=target,
            reason=data.reason,
            changed_by_id=user.id,
        )
    )
    await session.commit()
    return await _get_live(session, organization_id, claim_id=claim_id)


async def status_history(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, *, user: User
) -> list[ClaimStatusChange]:
    """Every status change of a live claim, oldest first."""
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    await require_live(session, organization_id, claim_id)
    rows = await session.scalars(
        select(ClaimStatusChange)
        .where(
            ClaimStatusChange.claim_id == claim_id,
            ClaimStatusChange.organization_id == organization_id,
        )
        .options(selectinload(ClaimStatusChange.changed_by))
        .order_by(ClaimStatusChange.id)
    )
    return list(rows)


# ─── Listing ──────────────────────────────────────────────────────────────────

SORT_KEYS = {
    ClaimSort.NEWEST: SortKey([Claim.id], direction="desc"),  # UUIDv7: creation order
    ClaimSort.OLDEST: SortKey([Claim.id]),
    ClaimSort.RECENTLY_UPDATED: SortKey([Claim.updated_at, Claim.id], direction="desc"),
    ClaimSort.LOSS_DATE_DESC: SortKey([Claim.loss_date, Claim.id], direction="desc"),
    ClaimSort.LOSS_DATE_ASC: SortKey([Claim.loss_date, Claim.id]),
}


def _matching(q: str) -> ColumnElement[bool]:
    return or_(
        icontains(Claim.number, q),
        icontains(Claim.carrier_name, q),
        icontains(Claim.carrier_claim_number, q),
        icontains(Claim.policy_number, q),
        Claim.property.has(
            or_(
                icontains(Property.address_line1, q),
                icontains(Property.city, q),
                icontains(Property.postal_code, q),
            )
        ),
        Claim.contacts.any(ClaimContact.contact.has(icontains(Contact.full_name, q))),
    )


async def list_claims(
    session: AsyncSession,
    organization_id: UUID,
    query: ClaimListQuery,
    *,
    user: User,
    limit: int,
    cursor: str | None,
) -> Page[Claim]:
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    statement = (
        select(Claim)
        .where(Claim.organization_id == organization_id, Claim.not_deleted())
        .options(
            selectinload(Claim.property),
            selectinload(Claim.primary_contact).selectinload(ClaimContact.contact),
            selectinload(Claim.adjuster),
        )
        .execution_options(populate_existing=True)
    )
    if query.status:
        statement = statement.where(Claim.status.in_(query.status))
    if query.loss_type:
        statement = statement.where(Claim.loss_type.in_(query.loss_type))
    if query.property_id is not None:
        statement = statement.where(Claim.property_id == query.property_id)
    if query.contact_id is not None:
        statement = statement.where(Claim.contacts.any(ClaimContact.contact_id == query.contact_id))
    if query.assigned_to is not None:
        statement = statement.where(
            Claim.assignments.any(ClaimAssignment.user_id == query.assigned_to)
        )
    if query.has_adjuster is not None:
        has_one = Claim.assignments.any(ClaimAssignment.role == AssignmentRole.ADJUSTER)
        statement = statement.where(has_one if query.has_adjuster else ~has_one)
    if query.loss_date_from is not None:
        statement = statement.where(Claim.loss_date >= query.loss_date_from)
    if query.loss_date_to is not None:
        statement = statement.where(Claim.loss_date <= query.loss_date_to)
    if query.q:
        statement = statement.where(_matching(query.q))
    return await paginate(session, statement, SORT_KEYS[query.sort], limit=limit, cursor=cursor)


# ─── Contacts on a claim ──────────────────────────────────────────────────────


def _find_link(claim: Claim, contact_id: UUID) -> ClaimContact | None:
    return next((link for link in claim.contacts if link.contact_id == contact_id), None)


def _linked(claim: Claim, contact_id: UUID) -> ClaimContact:
    link = _find_link(claim, contact_id)
    if link is None:
        raise NotFoundError(
            "That contact is not linked to this claim",
            claim_id=str(claim.id),
            contact_id=str(contact_id),
        )
    return link


async def _make_primary(session: AsyncSession, claim: Claim, link: ClaimContact) -> None:
    """Demote the current primary first, so the claim never has two at once."""
    for other in claim.contacts:
        if other is not link and other.is_primary:
            other.is_primary = False
    await session.flush()
    link.is_primary = True


async def _load_link(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, contact_id: UUID
) -> ClaimContact:
    link = await session.scalar(
        select(ClaimContact)
        .where(
            ClaimContact.organization_id == organization_id,
            ClaimContact.claim_id == claim_id,
            ClaimContact.contact_id == contact_id,
        )
        .options(selectinload(ClaimContact.contact))
        .execution_options(populate_existing=True)
    )
    if link is None:
        raise NotFoundError("Contact link not found")
    return link


async def link_contact(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    data: ClaimContactLink,
    *,
    user: User,
) -> ClaimContact:
    await authorize(session, user, organization_id, Permission.CLAIMS_WRITE)
    claim = await _get_editable(session, organization_id, claim_id)
    if _find_link(claim, data.contact_id) is not None:
        raise ContactAlreadyLinkedError(
            "That contact is already linked to this claim; change its role instead",
            contact_id=str(data.contact_id),
        )
    await _check_contacts(session, organization_id, [data.contact_id])

    link = ClaimContact(
        organization_id=organization_id,
        claim_id=claim.id,
        contact_id=data.contact_id,
        role=data.role,
        is_primary=False,
    )
    session.add(link)
    if data.is_primary:
        await _make_primary(session, claim, link)
    await session.commit()
    return await _load_link(session, organization_id, claim.id, data.contact_id)


async def update_contact_link(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    contact_id: UUID,
    data: ClaimContactLinkUpdate,
    *,
    user: User,
) -> ClaimContact:
    await authorize(session, user, organization_id, Permission.CLAIMS_WRITE)
    claim = await _get_editable(session, organization_id, claim_id)
    link = _linked(claim, contact_id)
    if data.role is not None:
        link.role = data.role
    if data.is_primary:
        await _make_primary(session, claim, link)
    elif data.is_primary is False:
        link.is_primary = False
    await session.commit()
    return await _load_link(session, organization_id, claim.id, contact_id)


async def unlink_contact(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, contact_id: UUID, *, user: User
) -> None:
    await authorize(session, user, organization_id, Permission.CLAIMS_WRITE)
    claim = await _get_editable(session, organization_id, claim_id)
    link = _linked(claim, contact_id)
    await session.delete(link)
    await session.commit()


# ─── Assignments ──────────────────────────────────────────────────────────────

#: What a member's organization role must allow for each assignment role.
ASSIGNMENT_NEEDS = {
    AssignmentRole.ADJUSTER: Permission.CLAIMS_WRITE,
    AssignmentRole.CONTRACTOR: Permission.FIELD_DATA_WRITE,
    AssignmentRole.FIELD_TECHNICIAN: Permission.FIELD_DATA_WRITE,
}


async def _check_assignee(
    session: AsyncSession, organization_id: UUID, data: ClaimAssignmentCreate
) -> None:
    member_role = await session.scalar(
        select(Membership.role).where(
            Membership.organization_id == organization_id,
            Membership.user_id == data.user_id,
        )
    )
    if member_role is None:
        raise UnknownAssigneeError(
            "Only members of this organization can be assigned", user_id=str(data.user_id)
        )
    needed = ASSIGNMENT_NEEDS[data.role]
    if not has_permission(member_role, needed):
        raise AssigneeLacksPermissionError(
            f"A {member_role} can't be assigned as {data.role}",
            member_role=str(member_role),
            assignee_needs=needed.value,
        )


async def _load_assignment(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, user_id: UUID
) -> ClaimAssignment:
    assignment = await session.scalar(
        select(ClaimAssignment)
        .where(
            ClaimAssignment.organization_id == organization_id,
            ClaimAssignment.claim_id == claim_id,
            ClaimAssignment.user_id == user_id,
        )
        .options(selectinload(ClaimAssignment.user))
        .execution_options(populate_existing=True)
    )
    if assignment is None:
        raise NotFoundError("That member is not assigned to this claim", user_id=str(user_id))
    return assignment


async def assign(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    data: ClaimAssignmentCreate,
    *,
    user: User,
) -> ClaimAssignment:
    """Assign a member. A new adjuster replaces the current one in the same transaction."""
    await authorize(session, user, organization_id, Permission.CLAIMS_WRITE)
    claim = await _get_editable(session, organization_id, claim_id)
    await _check_assignee(session, organization_id, data)
    existing = next((a for a in claim.assignments if a.user_id == data.user_id), None)
    if existing is not None:
        raise AlreadyAssignedError(
            f"Already assigned to this claim as {existing.role}; unassign first to change roles",
            user_id=str(data.user_id),
            current_role=str(existing.role),
        )

    if data.role == AssignmentRole.ADJUSTER:
        for previous in [a for a in claim.assignments if a.role == AssignmentRole.ADJUSTER]:
            claim.assignments.remove(previous)  # delete-orphan: audited as a removal
        await session.flush()  # free the one-adjuster slot before taking it
    claim.assignments.append(
        ClaimAssignment(
            organization_id=organization_id,
            user_id=data.user_id,
            role=data.role,
            assigned_by_id=user.id,
        )
    )
    await session.commit()
    return await _load_assignment(session, organization_id, claim.id, data.user_id)


async def unassign(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, user_id: UUID, *, user: User
) -> None:
    await authorize(session, user, organization_id, Permission.CLAIMS_WRITE)
    claim = await _get_editable(session, organization_id, claim_id)
    assignment = next((a for a in claim.assignments if a.user_id == user_id), None)
    if assignment is None:
        raise NotFoundError("That member is not assigned to this claim", user_id=str(user_id))
    claim.assignments.remove(assignment)
    await session.commit()
