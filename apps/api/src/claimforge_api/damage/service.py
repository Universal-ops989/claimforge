"""Recording what is damaged in each room of a claim.

Same access rules as the rooms themselves: reading needs ``claims:read``; changes need
``field_data:write`` and a claim that is not closed or cancelled.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.auth.permissions import Permission, authorize
from claimforge_api.claims import service as claims
from claimforge_api.claims.models import Claim, LossType
from claimforge_api.core.errors import BusinessRuleError, NotFoundError
from claimforge_api.damage.models import BLACK_WATER_CAUSES, WATER_CAUSES, DamageItem
from claimforge_api.damage.schemas import DamageItemCreate, DamageItemQuery, DamageItemUpdate
from claimforge_api.structures.models import Room
from claimforge_api.users.models import User


class NotWaterDamageError(BusinessRuleError):
    code = "not_water_damage"
    title = "Not water damage"


class BlackWaterCategoryError(BusinessRuleError):
    code = "black_water_category"
    title = "Sewage and flood water are Category 3"


class UnknownRoomError(BusinessRuleError):
    code = "unknown_room"
    title = "Unknown room"


def settle_water_category(
    cause: LossType, water_category: int | None, water_class: int | None
) -> int | None:
    """The water category to store for an item with these details, or why they don't fit."""
    if cause not in WATER_CAUSES:
        if water_category is not None or water_class is not None:
            raise NotWaterDamageError(
                f"Water category and class don't apply to {cause} damage; clear them first",
                cause=cause.value,
            )
        return None
    if cause in BLACK_WATER_CAUSES:
        if water_category not in (None, 3):
            raise BlackWaterCategoryError(
                f"{cause.capitalize()} water is always Category 3", cause=cause.value
            )
        return 3
    return water_category


async def _room_exists(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, room_id: UUID
) -> bool:
    found = await session.scalar(
        select(Room.id).where(
            Room.id == room_id, Room.claim_id == claim_id, Room.organization_id == organization_id
        )
    )
    return found is not None


async def _get_item(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, item_id: UUID
) -> DamageItem:
    item = await session.scalar(
        select(DamageItem)
        .where(
            DamageItem.id == item_id,
            DamageItem.claim_id == claim_id,
            DamageItem.organization_id == organization_id,
        )
        # Reload after commit for the database's updated_at.
        .execution_options(populate_existing=True)
    )
    if item is None:
        raise NotFoundError("Damage item not found", damage_item_id=str(item_id))
    return item


async def list_items(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    query: DamageItemQuery,
    *,
    user: User,
) -> list[DamageItem]:
    """A claim's damage items, grouped by room in the order rooms were added."""
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    await claims.require_live(session, organization_id, claim_id)
    statement = (
        select(DamageItem)
        .where(DamageItem.claim_id == claim_id, DamageItem.organization_id == organization_id)
        .order_by(DamageItem.room_id, DamageItem.id)
    )
    if query.room_id is not None:
        statement = statement.where(DamageItem.room_id == query.room_id)
    if query.cause is not None:
        statement = statement.where(DamageItem.cause == query.cause)
    return list(await session.scalars(statement))


async def get_item(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, item_id: UUID, *, user: User
) -> DamageItem:
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    await claims.require_live(session, organization_id, claim_id)
    return await _get_item(session, organization_id, claim_id, item_id)


async def create_item(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    room_id: UUID,
    data: DamageItemCreate,
    *,
    user: User,
) -> DamageItem:
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    if not await _room_exists(session, organization_id, claim_id, room_id):
        raise NotFoundError("Room not found", room_id=str(room_id))
    # A fire claim can still have water damage (from putting the fire out), so the claim's
    # loss type is only the default.
    cause = data.cause or LossType(
        (await session.execute(select(Claim.loss_type).where(Claim.id == claim_id))).scalar_one()
    )
    item = DamageItem(
        organization_id=organization_id,
        claim_id=claim_id,
        room_id=room_id,
        created_by_id=user.id,
        **data.model_dump(exclude={"cause", "water_category"}),
        cause=cause,
        water_category=settle_water_category(cause, data.water_category, data.water_class),
    )
    session.add(item)
    await session.commit()
    return await _get_item(session, organization_id, claim_id, item.id)


async def update_item(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    item_id: UUID,
    data: DamageItemUpdate,
    *,
    user: User,
) -> DamageItem:
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    item = await _get_item(session, organization_id, claim_id, item_id)
    changes = data.model_dump(exclude_unset=True)

    room_id = changes.get("room_id", item.room_id)
    if room_id != item.room_id and not await _room_exists(
        session, organization_id, claim_id, room_id
    ):
        raise UnknownRoomError("No such room on this claim", room_id=str(room_id))
    # The rules apply to the item as it will be, not just to the fields sent. Turning it
    # into sewage or flood damage raises the category to 3 without being told; turning it
    # into fire damage does not silently drop the water details.
    cause = LossType(changes.get("cause", item.cause))
    kept_category = None if cause in BLACK_WATER_CAUSES else item.water_category
    changes["water_category"] = settle_water_category(
        cause,
        changes.get("water_category", kept_category),
        changes.get("water_class", item.water_class),
    )

    for field, value in changes.items():
        setattr(item, field, value)
    # Unchanged values leave no history, so a no-op writes neither a row nor an audit event.
    await session.commit()
    return await _get_item(session, organization_id, claim_id, item_id)


async def delete_item(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, item_id: UUID, *, user: User
) -> None:
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    item = await _get_item(session, organization_id, claim_id, item_id)
    await session.delete(item)
    await session.commit()
