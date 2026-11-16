"""Writing estimates for a claim, line by line, and moving them through approval.

Reading needs ``claims:read``. Drafts are written with ``estimates:write``; submitting,
withdrawing and reworking need it too, while approving, rejecting and reopening an
approved estimate need ``estimates:approve``. Closed and cancelled claims are read-only.
The claim row is locked for every change, so numbers and positions can't collide.
"""

from uuid import UUID

from sqlalchemy import Select, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from claimforge_api.auth.permissions import Permission, authorize, has_permission
from claimforge_api.claims import service as claims
from claimforge_api.core.errors import (
    BusinessRuleError,
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
)
from claimforge_api.estimates.models import Estimate, EstimateLine, EstimateStatus
from claimforge_api.estimates.schemas import (
    EstimateCreate,
    EstimateRead,
    EstimateUpdate,
    LineCreate,
    LineUpdate,
)
from claimforge_api.pricing.models import PriceItem, PriceList
from claimforge_api.structures.models import Room
from claimforge_api.users.models import User

#: Where each status can go, and the permission each move needs.
TRANSITIONS: dict[EstimateStatus, dict[EstimateStatus, Permission]] = {
    EstimateStatus.DRAFT: {EstimateStatus.SUBMITTED: Permission.ESTIMATES_WRITE},
    EstimateStatus.SUBMITTED: {
        EstimateStatus.DRAFT: Permission.ESTIMATES_WRITE,  # withdrawn to change it
        EstimateStatus.APPROVED: Permission.ESTIMATES_APPROVE,
        EstimateStatus.REJECTED: Permission.ESTIMATES_APPROVE,
    },
    EstimateStatus.REJECTED: {EstimateStatus.DRAFT: Permission.ESTIMATES_WRITE},
    EstimateStatus.APPROVED: {EstimateStatus.DRAFT: Permission.ESTIMATES_APPROVE},
}


class EstimateNotDraftError(ConflictError):
    code = "estimate_not_draft"
    title = "Only draft estimates can be changed"


class EstimateTransitionError(BusinessRuleError):
    code = "estimate_transition"
    title = "The estimate can't move to that status"


class UnknownPriceListError(BusinessRuleError):
    code = "unknown_price_list"
    title = "No such price list in the organization"


class UnknownPriceItemError(BusinessRuleError):
    code = "unknown_price_item"
    title = "No such price item in the organization"


class UnknownRoomError(BusinessRuleError):
    code = "unknown_room"
    title = "Unknown room"


def _estimates(organization_id: UUID, claim_id: UUID) -> Select[Estimate]:
    return select(Estimate).where(
        Estimate.claim_id == claim_id, Estimate.organization_id == organization_id
    )


async def _get(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, estimate_id: UUID
) -> Estimate:
    estimate = await session.scalar(
        _estimates(organization_id, claim_id)
        .where(Estimate.id == estimate_id)
        .options(
            selectinload(Estimate.price_list),
            selectinload(Estimate.created_by),
            selectinload(Estimate.lines).selectinload(EstimateLine.room),
        )
        .execution_options(populate_existing=True)
    )
    if estimate is None:
        raise NotFoundError("Estimate not found", estimate_id=str(estimate_id))
    return estimate


def present(estimate: Estimate) -> EstimateRead:
    return EstimateRead.model_validate(
        {
            **{
                name: getattr(estimate, name)
                for name in (
                    "id",
                    "claim_id",
                    "number",
                    "title",
                    "status",
                    "created_at",
                    "updated_at",
                    "price_list",
                    "notes",
                    "created_by",
                    "lines",
                )
            },
            "next_statuses": list(TRANSITIONS[EstimateStatus(estimate.status)]),
        }
    )


def _require_draft(estimate: Estimate) -> None:
    if estimate.status != EstimateStatus.DRAFT:
        raise EstimateNotDraftError(
            f"Estimate {estimate.number} is {estimate.status}; move it back to draft first",
            estimate_status=str(estimate.status),
        )


async def _price_list(
    session: AsyncSession, organization_id: UUID, list_id: UUID | None
) -> UUID | None:
    """``list_id`` if it's the organization's; without one, the default (if any)."""
    if list_id is None:
        return await session.scalar(
            select(PriceList.id).where(
                PriceList.organization_id == organization_id, PriceList.is_default.is_(True)
            )
        )
    found = await session.scalar(
        select(PriceList.id).where(
            PriceList.id == list_id, PriceList.organization_id == organization_id
        )
    )
    if found is None:
        raise UnknownPriceListError(price_list_id=str(list_id))
    return found


async def _check_room(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, room_id: UUID | None
) -> None:
    if room_id is None:
        return
    found = await session.scalar(
        select(Room.id).where(
            Room.id == room_id, Room.claim_id == claim_id, Room.organization_id == organization_id
        )
    )
    if found is None:
        raise UnknownRoomError("No such room on this claim", room_id=str(room_id))


# ─── Estimates ────────────────────────────────────────────────────────────────


async def list_estimates(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, *, user: User
) -> list[Estimate]:
    """A claim's estimates by number."""
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    await claims.require_live(session, organization_id, claim_id)
    return list(
        await session.scalars(_estimates(organization_id, claim_id).order_by(Estimate.number))
    )


async def get_estimate(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, estimate_id: UUID, *, user: User
) -> Estimate:
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    await claims.require_live(session, organization_id, claim_id)
    return await _get(session, organization_id, claim_id, estimate_id)


async def create_estimate(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    data: EstimateCreate,
    *,
    user: User,
) -> Estimate:
    await authorize(session, user, organization_id, Permission.ESTIMATES_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    highest = await session.scalar(
        select(func.max(Estimate.number)).where(Estimate.claim_id == claim_id)
    )
    estimate = Estimate(
        organization_id=organization_id,
        claim_id=claim_id,
        number=(highest or 0) + 1,
        title=data.title,
        price_list_id=await _price_list(session, organization_id, data.price_list_id),
        notes=data.notes,
        created_by_id=user.id,
    )
    session.add(estimate)
    await session.commit()
    return await _get(session, organization_id, claim_id, estimate.id)


async def update_estimate(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    estimate_id: UUID,
    data: EstimateUpdate,
    *,
    user: User,
) -> Estimate:
    await authorize(session, user, organization_id, Permission.ESTIMATES_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    estimate = await _get(session, organization_id, claim_id, estimate_id)
    _require_draft(estimate)
    changes = data.model_dump(exclude_unset=True)
    if changes.get("price_list_id") is not None:
        await _price_list(session, organization_id, changes["price_list_id"])
    for field, value in changes.items():
        setattr(estimate, field, value)
    await session.commit()
    return await _get(session, organization_id, claim_id, estimate_id)


async def change_status(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    estimate_id: UUID,
    status: EstimateStatus,
    *,
    user: User,
) -> Estimate:
    membership = await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    await claims.lock_for_changes(session, organization_id, claim_id)
    estimate = await _get(session, organization_id, claim_id, estimate_id)
    allowed = TRANSITIONS[EstimateStatus(estimate.status)]
    needed = allowed.get(status)
    if needed is None:
        raise EstimateTransitionError(
            f"A {estimate.status} estimate can't become {status}",
            allowed=[str(s) for s in allowed],
        )
    if not has_permission(membership.role, needed):
        raise PermissionDeniedError(f"Moving an estimate to {status} needs {needed}")
    if status == EstimateStatus.SUBMITTED and not estimate.lines:
        raise EstimateTransitionError("An estimate needs at least one line to be submitted")
    estimate.status = status
    await session.commit()
    return await _get(session, organization_id, claim_id, estimate_id)


async def delete_estimate(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, estimate_id: UUID, *, user: User
) -> None:
    """Drafts only: what was sent to a carrier stays on record."""
    await authorize(session, user, organization_id, Permission.ESTIMATES_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    estimate = await _get(session, organization_id, claim_id, estimate_id)
    _require_draft(estimate)
    await session.delete(estimate)
    await session.commit()


# ─── Lines ────────────────────────────────────────────────────────────────────


async def _draft(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, estimate_id: UUID, user: User
) -> Estimate:
    await authorize(session, user, organization_id, Permission.ESTIMATES_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    estimate = await _get(session, organization_id, claim_id, estimate_id)
    _require_draft(estimate)
    return estimate


async def _shift(
    session: AsyncSession, estimate_id: UUID, *, from_position: int, by: int, upto: int | None
) -> None:
    """Move the lines from ``from_position`` (to ``upto``) down or up by ``by``."""
    statement = (
        update(EstimateLine)
        .where(EstimateLine.estimate_id == estimate_id, EstimateLine.position >= from_position)
        .values(position=EstimateLine.position + by)
        .execution_options(synchronize_session=False)
    )
    if upto is not None:
        statement = statement.where(EstimateLine.position <= upto)
    await session.execute(statement)


async def add_line(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    estimate_id: UUID,
    data: LineCreate,
    *,
    user: User,
) -> Estimate:
    estimate = await _draft(session, organization_id, claim_id, estimate_id, user)
    await _check_room(session, organization_id, claim_id, data.room_id)
    values = data.model_dump(exclude={"position", "price_item_id"})
    if data.price_item_id is not None:
        item = await session.scalar(
            select(PriceItem).where(
                PriceItem.id == data.price_item_id, PriceItem.organization_id == organization_id
            )
        )
        if item is None:
            raise UnknownPriceItemError(price_item_id=str(data.price_item_id))
        values |= {
            "code": item.code,
            "description": item.description,
            "unit": item.unit,
            "unit_price": item.unit_price,
        }
    end = len(estimate.lines) + 1
    position = min(data.position or end, end)
    if position < end:
        await _shift(session, estimate.id, from_position=position, by=1, upto=None)
    session.add(
        EstimateLine(
            organization_id=organization_id,
            claim_id=claim_id,
            estimate_id=estimate.id,
            position=position,
            price_item_id=data.price_item_id,
            **values,
        )
    )
    await session.commit()
    return await _get(session, organization_id, claim_id, estimate_id)


async def update_line(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    estimate_id: UUID,
    line_id: UUID,
    data: LineUpdate,
    *,
    user: User,
) -> Estimate:
    estimate = await _draft(session, organization_id, claim_id, estimate_id, user)
    line = next((ln for ln in estimate.lines if ln.id == line_id), None)
    if line is None:
        raise NotFoundError("Line not found", line_id=str(line_id))
    changes = data.model_dump(exclude_unset=True)
    if changes.get("room_id") is not None:
        await _check_room(session, organization_id, claim_id, changes["room_id"])
    position = changes.pop("position", None)
    if position is not None:
        position = min(position, len(estimate.lines))
        if position < line.position:
            await _shift(session, estimate.id, from_position=position, by=1, upto=line.position - 1)
        elif position > line.position:
            await _shift(
                session, estimate.id, from_position=line.position + 1, by=-1, upto=position
            )
        changes["position"] = position
    for field, value in changes.items():
        setattr(line, field, value)
    await session.commit()
    return await _get(session, organization_id, claim_id, estimate_id)


async def delete_line(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    estimate_id: UUID,
    line_id: UUID,
    *,
    user: User,
) -> Estimate:
    estimate = await _draft(session, organization_id, claim_id, estimate_id, user)
    line = next((ln for ln in estimate.lines if ln.id == line_id), None)
    if line is None:
        raise NotFoundError("Line not found", line_id=str(line_id))
    position = line.position
    await session.delete(line)
    await session.flush()
    await _shift(session, estimate.id, from_position=position + 1, by=-1, upto=None)
    await session.commit()
    return await _get(session, organization_id, claim_id, estimate_id)
