"""Recording damaged materials per room: cause of loss, water category and class."""

from typing import Any
from uuid import UUID

import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.audit.models import AuditEvent
from claimforge_api.claims import service as claims
from claimforge_api.claims.models import Claim, LossType
from claimforge_api.claims.schemas import ClaimCreate, ClaimStatusChangeCreate
from claimforge_api.core.errors import NotFoundError, PermissionDeniedError
from claimforge_api.damage import service
from claimforge_api.damage.models import DamageItem
from claimforge_api.damage.schemas import DamageItemCreate, DamageItemQuery, DamageItemUpdate
from claimforge_api.structures import service as structures
from claimforge_api.structures.models import Room, Structure
from claimforge_api.structures.schemas import RoomCreate, StructureCreate
from claimforge_api.users import service as users
from claimforge_api.users.models import Membership, Role, User

ADDRESS = {"line1": "123 Main St", "city": "Austin", "region": "TX", "postal_code": "78701"}


class Site:
    """One claim, its rooms, and a user recording damage in them."""

    def __init__(
        self, session: AsyncSession, organization_id: UUID, claim: Claim, user: User
    ) -> None:
        self.session, self.organization_id, self.claim, self.user = (
            session,
            organization_id,
            claim,
            user,
        )

    @classmethod
    async def open(
        cls, session: AsyncSession, organization_id: UUID, user: User, loss_type: str = "water"
    ) -> "Site":
        data = ClaimCreate.model_validate(
            {"loss_type": loss_type, "property": {"address": ADDRESS}}
        )
        claim = await claims.create_claim(session, organization_id, data, user=user)
        return cls(session, organization_id, claim, user)

    def by(self, user: User) -> "Site":
        return Site(self.session, self.organization_id, self.claim, user)

    async def structure(self, name: str) -> Structure:
        return await structures.create_structure(
            self.session,
            self.organization_id,
            self.claim.id,
            StructureCreate(name=name),
            user=self.user,
        )

    async def room(self, structure: Structure, name: str) -> Room:
        return await structures.create_room(
            self.session,
            self.organization_id,
            self.claim.id,
            structure.id,
            RoomCreate(name=name),
            user=self.user,
        )

    async def damage(self, room: Room, **fields: Any) -> DamageItem:
        body = {"surface": "wall", "material": "Drywall"} | fields
        return await service.create_item(
            self.session,
            self.organization_id,
            self.claim.id,
            room.id,
            DamageItemCreate.model_validate(body),
            user=self.user,
        )

    async def update(self, item: DamageItem, **fields: Any) -> DamageItem:
        return await service.update_item(
            self.session,
            self.organization_id,
            self.claim.id,
            item.id,
            DamageItemUpdate.model_validate(fields),
            user=self.user,
        )

    async def items(self, **query: Any) -> list[tuple[str, str, int | None]]:
        rows = await service.list_items(
            self.session,
            self.organization_id,
            self.claim.id,
            DamageItemQuery.model_validate(query),
            user=self.user,
        )
        return [(i.material, i.cause, i.water_category) for i in rows]


@pytest.fixture
async def site(db_session: AsyncSession, organization_id: UUID, user: User) -> Site:
    return await Site.open(db_session, organization_id, user)


@pytest.fixture
async def kitchen(site: Site) -> Room:
    return await site.room(await site.structure("Main house"), "Kitchen")


async def audit_actions(session: AsyncSession) -> list[str]:
    rows = await session.scalars(
        select(AuditEvent.action)
        .where(AuditEvent.entity_type == "damage_item")
        .order_by(AuditEvent.id)
    )
    return list(rows)


# ─── The water rules ──────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("cause", "category", "water_class", "stored"),
    [
        (LossType.WATER, None, None, None),
        (LossType.WATER, 2, 3, 2),
        (LossType.STORM, 1, 2, 1),
        (LossType.SEWAGE, None, None, 3),
        (LossType.SEWAGE, 3, 2, 3),
        (LossType.FLOOD, None, 4, 3),
        (LossType.FIRE, None, None, None),
    ],
)
def test_water_category_to_store(
    cause: LossType, category: int | None, water_class: int | None, stored: int | None
) -> None:
    assert service.settle_water_category(cause, category, water_class) == stored


@pytest.mark.parametrize(
    ("cause", "category", "water_class", "error"),
    [
        (LossType.FIRE, 1, None, service.NotWaterDamageError),
        (LossType.MOLD, None, 2, service.NotWaterDamageError),
        (LossType.SEWAGE, 1, None, service.BlackWaterCategoryError),
        (LossType.FLOOD, 2, None, service.BlackWaterCategoryError),
    ],
)
def test_water_details_that_do_not_fit(
    cause: LossType, category: int | None, water_class: int | None, error: type[Exception]
) -> None:
    with pytest.raises(error):
        service.settle_water_category(cause, category, water_class)


def test_input_validation() -> None:
    for body in [
        {"surface": "roof", "material": "Shingles"},
        {"surface": "wall", "material": " "},
        {"surface": "wall", "material": "Drywall", "water_category": 4},
        {"surface": "wall", "material": "Drywall", "water_class": 0},
    ]:
        with pytest.raises(ValidationError):
            DamageItemCreate.model_validate(body)
    for field in ("room_id", "surface", "material", "cause"):
        with pytest.raises(ValidationError, match=f"{field} cannot be cleared"):
            DamageItemUpdate.model_validate({field: None})


# ─── Recording damage ─────────────────────────────────────────────────────────


async def test_record_damage_in_a_room(site: Site, kitchen: Room) -> None:
    drywall = await site.damage(kitchen, description=" Wet to 24 in. ", water_class=2)
    await site.damage(kitchen, surface="floor", material="Vinyl plank", water_category=1)

    # The cause defaults to the claim's loss type.
    assert (drywall.cause, drywall.water_category, drywall.water_class) == ("water", None, 2)
    assert drywall.description == "Wet to 24 in."
    assert drywall.created_by_id == site.user.id
    assert await site.items() == [("Drywall", "water", None), ("Vinyl plank", "water", 1)]


async def test_a_fire_claim_can_have_water_damage(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    fire = await Site.open(db_session, organization_id, user, loss_type="fire")
    den = await fire.room(await fire.structure("House"), "Den")

    await fire.damage(den, material="Ceiling tile", surface="ceiling")
    # The hoses came later.
    await fire.damage(den, material="Carpet", surface="floor", cause="water", water_category=2)
    with pytest.raises(service.NotWaterDamageError):
        await fire.damage(den, material="Paneling", water_class=2)

    assert await fire.items() == [("Ceiling tile", "fire", None), ("Carpet", "water", 2)]


async def test_sewage_is_category_3(site: Site, kitchen: Room) -> None:
    backup = await site.damage(kitchen, material="Base cabinet", cause="sewage")
    assert backup.water_category == 3

    with pytest.raises(service.BlackWaterCategoryError):
        await site.damage(kitchen, material="Toe kick", cause="sewage", water_category=2)
    with pytest.raises(service.BlackWaterCategoryError):
        await site.update(backup, water_category=1)


async def test_update_checks_the_item_as_it_will_be(site: Site, kitchen: Room) -> None:
    item = await site.damage(kitchen, water_category=2, water_class=3)

    # Becoming sewage damage raises the category to 3 without being told.
    item = await site.update(item, cause="sewage")
    assert (item.water_category, item.water_class) == (3, 3)
    item = await site.update(item, cause="water")
    assert item.water_category == 3

    # Becoming fire damage doesn't silently drop the water details...
    with pytest.raises(service.NotWaterDamageError):
        await site.update(item, cause="fire")
    # ...but clearing them in the same request is fine.
    item = await site.update(item, cause="fire", water_category=None, water_class=None)
    assert (item.cause, item.water_category, item.water_class) == ("fire", None, None)


async def test_move_between_rooms(site: Site, kitchen: Room) -> None:
    pantry = await site.room(await site.structure("Garage"), "Pantry")
    item = await site.damage(kitchen, material="Shelving")

    item = await site.update(item, room_id=pantry.id)
    assert item.room_id == pantry.id

    other = await Site.open(site.session, site.organization_id, site.user)
    elsewhere = await other.room(await other.structure("House"), "Kitchen")
    with pytest.raises(service.UnknownRoomError):
        await site.update(item, room_id=elsewhere.id)
    with pytest.raises(NotFoundError, match="Room not found"):
        await site.damage(elsewhere)


async def test_no_op_updates_leave_no_trace(
    db_session: AsyncSession, site: Site, kitchen: Room
) -> None:
    item = await site.damage(kitchen, water_category=2)
    before = await audit_actions(db_session)

    await site.update(item, material="Drywall", water_category=2)

    assert await audit_actions(db_session) == before == ["damage_item.created"]


async def test_list_by_room_and_cause(site: Site, kitchen: Room) -> None:
    house = (
        await structures.list_structures(
            site.session, site.organization_id, site.claim.id, user=site.user
        )
    )[0]
    bath = await site.room(house, "Bath")
    await site.damage(bath, material="Tile")
    await site.damage(kitchen, material="Cabinet", cause="mold")
    await site.damage(kitchen, material="Drywall")

    # Grouped by room, in the order the rooms were added.
    assert [m for m, _, _ in await site.items()] == ["Cabinet", "Drywall", "Tile"]
    assert [m for m, _, _ in await site.items(room_id=bath.id)] == ["Tile"]
    assert [m for m, _, _ in await site.items(cause="mold")] == ["Cabinet"]


async def test_delete(db_session: AsyncSession, site: Site, kitchen: Room) -> None:
    item = await site.damage(kitchen)

    await service.delete_item(
        db_session, site.organization_id, site.claim.id, item.id, user=site.user
    )

    assert await site.items() == []
    with pytest.raises(NotFoundError, match="Damage item not found"):
        await service.get_item(
            db_session, site.organization_id, site.claim.id, item.id, user=site.user
        )


async def test_deleting_a_room_or_structure_deletes_its_damage(
    db_session: AsyncSession, site: Site, kitchen: Room
) -> None:
    garage = await site.structure("Garage")
    shop = await site.room(garage, "Shop")
    await site.damage(kitchen, material="Drywall")
    await site.damage(kitchen, material="Baseboard")
    await site.damage(shop, material="Pegboard")

    await structures.delete_room(
        db_session, site.organization_id, site.claim.id, kitchen.id, user=site.user
    )
    assert [m for m, _, _ in await site.items()] == ["Pegboard"]
    await structures.delete_structure(
        db_session, site.organization_id, site.claim.id, garage.id, user=site.user
    )
    assert await site.items() == []

    # Each removal is in the audit log, not just the room's and the structure's.
    assert (await audit_actions(db_session)).count("damage_item.deleted") == 3


async def test_who_may_record_damage(
    db_session: AsyncSession, organization_id: UUID, site: Site, kitchen: Room
) -> None:
    async def member(role: Role) -> User:
        person = await users.create_user(db_session, email=f"{role}@example.com", full_name="P")
        db_session.add(Membership(organization_id=organization_id, user_id=person.id, role=role))
        await db_session.commit()
        return person

    technician, viewer = await member(Role.TECHNICIAN), await member(Role.VIEWER)

    await site.by(technician).damage(kitchen)
    assert len(await site.by(viewer).items()) == 1
    with pytest.raises(PermissionDeniedError):
        await site.by(viewer).damage(kitchen)


async def test_closed_claims_are_read_only(
    db_session: AsyncSession, site: Site, kitchen: Room
) -> None:
    item = await site.damage(kitchen)
    await claims.change_status(
        db_session,
        site.organization_id,
        site.claim.id,
        ClaimStatusChangeCreate.model_validate({"status": "cancelled", "reason": "Duplicate"}),
        user=site.user,
    )

    with pytest.raises(claims.ClaimLockedError):
        await site.damage(kitchen)
    with pytest.raises(claims.ClaimLockedError):
        await site.update(item, material="Plaster")
    assert len(await site.items()) == 1


# ─── Database guarantees ──────────────────────────────────────────────────────


async def test_an_item_cannot_sit_in_another_claims_room(
    db_session: AsyncSession, site: Site, kitchen: Room
) -> None:
    other = await Site.open(db_session, site.organization_id, site.user)
    db_session.add(
        DamageItem(
            organization_id=site.organization_id,
            claim_id=other.claim.id,
            room_id=kitchen.id,
            surface="wall",
            material="Drywall",
            cause="water",
        )
    )
    with pytest.raises(IntegrityError, match="fk_damage_items_claim_id_rooms"):
        await db_session.flush()


@pytest.mark.parametrize(
    ("cause", "category", "constraint"),
    [
        ("sewage", 2, "black_water_is_category_3"),
        ("flood", None, "black_water_is_category_3"),
        ("fire", 1, "water_details_need_water"),
    ],
)
async def test_the_database_holds_the_water_rules_too(
    db_session: AsyncSession,
    site: Site,
    kitchen: Room,
    cause: str,
    category: int | None,
    constraint: str,
) -> None:
    db_session.add(
        DamageItem(
            organization_id=site.organization_id,
            claim_id=site.claim.id,
            room_id=kitchen.id,
            surface="wall",
            material="Drywall",
            cause=cause,
            water_category=category,
        )
    )
    with pytest.raises(IntegrityError, match=constraint):
        await db_session.flush()
