"""Laying out a claim's structures and rooms."""

from decimal import Decimal
from typing import Any
from uuid import UUID

import pytest
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.audit.models import AuditEvent
from claimforge_api.claims import service as claims
from claimforge_api.claims.models import Claim
from claimforge_api.claims.schemas import ClaimCreate, ClaimStatusChangeCreate
from claimforge_api.core.errors import NotFoundError, PermissionDeniedError
from claimforge_api.structures import service
from claimforge_api.structures.models import Room, Structure
from claimforge_api.structures.schemas import (
    RoomCreate,
    RoomRead,
    RoomUpdate,
    StructureCreate,
    StructureUpdate,
)
from claimforge_api.users import service as users
from claimforge_api.users.models import Membership, Role, User

ADDRESS = {"line1": "123 Main St", "city": "Austin", "region": "TX", "postal_code": "78701"}


async def new_claim(session: AsyncSession, organization_id: UUID, user: User) -> Claim:
    data = ClaimCreate.model_validate({"loss_type": "water", "property": {"address": ADDRESS}})
    return await claims.create_claim(session, organization_id, data, user=user)


@pytest.fixture
async def claim(db_session: AsyncSession, organization_id: UUID, user: User) -> Claim:
    return await new_claim(db_session, organization_id, user)


class Layout:
    """Shorthand for one user laying out one claim."""

    def __init__(
        self, session: AsyncSession, organization_id: UUID, claim_id: UUID, user: User
    ) -> None:
        self.session, self.organization_id, self.claim_id = session, organization_id, claim_id
        self.user = user

    def by(self, user: User) -> "Layout":
        return Layout(self.session, self.organization_id, self.claim_id, user)

    async def structure(self, name: str) -> Structure:
        return await service.create_structure(
            self.session,
            self.organization_id,
            self.claim_id,
            StructureCreate(name=name),
            user=self.user,
        )

    async def room(self, structure: Structure, name: str, **fields: Any) -> Room:
        return await service.create_room(
            self.session,
            self.organization_id,
            self.claim_id,
            structure.id,
            RoomCreate.model_validate({"name": name, **fields}),
            user=self.user,
        )

    async def update_room(self, room: Room, **fields: Any) -> Room:
        return await service.update_room(
            self.session,
            self.organization_id,
            self.claim_id,
            room.id,
            RoomUpdate.model_validate(fields),
            user=self.user,
        )

    async def plan(self) -> dict[str, list[str]]:
        structures = await service.list_structures(
            self.session, self.organization_id, self.claim_id, user=self.user
        )
        return {s.name: [r.name for r in s.rooms] for s in structures}


@pytest.fixture
def layout(db_session: AsyncSession, organization_id: UUID, user: User, claim: Claim) -> Layout:
    return Layout(db_session, organization_id, claim.id, user)


async def member(session: AsyncSession, organization_id: UUID, role: Role) -> User:
    person = await users.create_user(
        session, email=f"{role}@example.com", full_name=f"{role.title()} Person"
    )
    session.add(Membership(organization_id=organization_id, user_id=person.id, role=role))
    await session.commit()
    return person


async def audit_actions(session: AsyncSession) -> list[str]:
    rows = await session.scalars(
        select(AuditEvent.action)
        .where(AuditEvent.entity_type.in_(["structure", "room"]))
        .order_by(AuditEvent.id)
    )
    return list(rows)


async def test_lay_out_a_claim(layout: Layout) -> None:
    house = await layout.structure("Main house")
    garage = await layout.structure("Detached garage")
    await layout.room(house, "Kitchen", level="Main floor")
    await layout.room(house, "Basement", level="Basement")
    await layout.room(garage, "Workshop")

    assert await layout.plan() == {
        "Main house": ["Kitchen", "Basement"],
        "Detached garage": ["Workshop"],
    }


async def test_measures_are_derived_from_the_dimensions(layout: Layout) -> None:
    house = await layout.structure("Main house")
    kitchen = await layout.room(house, "Kitchen", length_ft=12.5, width_ft="10.25", height_ft=8)

    assert (kitchen.length_ft, kitchen.width_ft, kitchen.height_ft) == (
        Decimal("12.50"),
        Decimal("10.25"),
        Decimal("8.00"),
    )
    # 128.125 rounds half up.
    assert kitchen.floor_area_sqft == Decimal("128.13")
    assert kitchen.wall_area_sqft == Decimal("364.00")
    assert kitchen.volume_cuft == Decimal("1025.00")
    assert RoomRead.model_validate(kitchen).model_dump(mode="json")["volume_cuft"] == 1025.0

    hall = await layout.room(house, "Hall", length_ft=20, width_ft=4)
    assert (hall.floor_area_sqft, hall.wall_area_sqft, hall.volume_cuft) == (
        Decimal("80.00"),
        None,
        None,
    )


@pytest.mark.parametrize("value", [0, -1, "1.005", 10_000])
def test_dimensions_must_be_positive_hundredths_of_a_foot(value: object) -> None:
    with pytest.raises(ValidationError):
        RoomCreate.model_validate({"name": "Kitchen", "length_ft": value})


def test_names_cannot_be_cleared() -> None:
    with pytest.raises(ValidationError, match="name cannot be cleared"):
        RoomUpdate.model_validate({"name": None})
    with pytest.raises(ValidationError, match="structure_id cannot be cleared"):
        RoomUpdate.model_validate({"structure_id": None})
    with pytest.raises(ValidationError, match="name cannot be cleared"):
        StructureUpdate.model_validate({"name": None})
    with pytest.raises(ValidationError):
        StructureCreate.model_validate({"name": "   "})


async def test_names_are_unique_ignoring_case(layout: Layout) -> None:
    house = await layout.structure("Main house")
    garage = await layout.structure("Garage")
    await layout.room(house, "Bathroom")

    with pytest.raises(service.NameTakenError, match="structure named"):
        await layout.structure("MAIN HOUSE")
    with pytest.raises(service.NameTakenError, match="room named"):
        await layout.room(house, "bathroom")
    # Another structure may have its own bathroom.
    await layout.room(garage, "Bathroom")


async def test_rename(db_session: AsyncSession, organization_id: UUID, layout: Layout) -> None:
    house = await layout.structure("Main house")
    await layout.structure("Garage")
    kitchen = await layout.room(house, "kitchen")

    # Changing only the case of its own name is fine.
    house = await service.update_structure(
        db_session,
        organization_id,
        layout.claim_id,
        house.id,
        StructureUpdate(name="Main House"),
        user=layout.user,
    )
    kitchen = await layout.update_room(kitchen, name="Kitchen")
    with pytest.raises(service.NameTakenError):
        await service.update_structure(
            db_session,
            organization_id,
            layout.claim_id,
            house.id,
            StructureUpdate(name="garage"),
            user=layout.user,
        )

    assert await layout.plan() == {"Main House": ["Kitchen"], "Garage": []}


async def test_move_a_room(
    db_session: AsyncSession, organization_id: UUID, user: User, layout: Layout
) -> None:
    house = await layout.structure("Main house")
    garage = await layout.structure("Garage")
    office = await layout.room(house, "Office", length_ft=10, width_ft=10)
    await layout.room(garage, "Storage")
    storage = await layout.room(house, "Storage")

    office = await layout.update_room(office, structure_id=garage.id)
    assert office.structure_id == garage.id
    assert office.floor_area_sqft == Decimal("100.00")

    with pytest.raises(service.NameTakenError):
        await layout.update_room(storage, structure_id=garage.id)
    # Renaming on the way in avoids the clash.
    await layout.update_room(storage, structure_id=garage.id, name="Storage 2")

    elsewhere = await Layout(
        db_session, organization_id, (await new_claim(db_session, organization_id, user)).id, user
    ).structure("Shed")
    with pytest.raises(service.UnknownStructureError):
        await layout.update_room(office, structure_id=elsewhere.id)

    assert await layout.plan() == {"Main house": [], "Garage": ["Office", "Storage", "Storage 2"]}


async def test_update_changes_only_what_is_sent(db_session: AsyncSession, layout: Layout) -> None:
    house = await layout.structure("Main house")
    kitchen = await layout.room(house, "Kitchen", level="Main floor", length_ft=12, width_ft=10)

    kitchen = await layout.update_room(kitchen, width_ft=11, level=" ")

    assert (kitchen.name, kitchen.level, kitchen.length_ft, kitchen.width_ft) == (
        "Kitchen",
        None,
        Decimal("12.00"),
        Decimal("11.00"),
    )
    before = await audit_actions(db_session)
    await layout.update_room(kitchen, width_ft=11)
    assert await audit_actions(db_session) == before


async def test_deleting_a_structure_deletes_its_rooms(
    db_session: AsyncSession, organization_id: UUID, layout: Layout
) -> None:
    house = await layout.structure("Main house")
    garage = await layout.structure("Garage")
    await layout.room(house, "Kitchen")
    await layout.room(house, "Hall")
    await layout.room(garage, "Workshop")

    await service.delete_structure(
        db_session, organization_id, layout.claim_id, house.id, user=layout.user
    )

    assert await layout.plan() == {"Garage": ["Workshop"]}
    assert await db_session.scalar(select(func.count()).select_from(Room)) == 1
    # One flush writes all three; the recorder does not order events within a flush.
    actions = await audit_actions(db_session)
    assert sorted(actions[-3:]) == ["room.deleted", "room.deleted", "structure.deleted"]


async def test_delete_a_room(
    db_session: AsyncSession, organization_id: UUID, layout: Layout
) -> None:
    house = await layout.structure("Main house")
    kitchen = await layout.room(house, "Kitchen")

    await service.delete_room(
        db_session, organization_id, layout.claim_id, kitchen.id, user=layout.user
    )

    assert await layout.plan() == {"Main house": []}
    with pytest.raises(NotFoundError, match="Room not found"):
        await service.get_room(
            db_session, organization_id, layout.claim_id, kitchen.id, user=layout.user
        )


async def test_who_may_change_the_layout(
    db_session: AsyncSession, organization_id: UUID, layout: Layout
) -> None:
    technician = await member(db_session, organization_id, Role.TECHNICIAN)
    viewer = await member(db_session, organization_id, Role.VIEWER)

    house = await layout.by(technician).structure("Main house")
    await layout.by(technician).room(house, "Kitchen")

    assert await layout.by(viewer).plan() == {"Main house": ["Kitchen"]}
    with pytest.raises(PermissionDeniedError):
        await layout.by(viewer).room(house, "Hall")


async def test_closed_claims_are_read_only(
    db_session: AsyncSession, organization_id: UUID, layout: Layout
) -> None:
    house = await layout.structure("Main house")
    kitchen = await layout.room(house, "Kitchen")
    await claims.change_status(
        db_session,
        organization_id,
        layout.claim_id,
        ClaimStatusChangeCreate.model_validate({"status": "cancelled", "reason": "Duplicate"}),
        user=layout.user,
    )

    with pytest.raises(claims.ClaimLockedError):
        await layout.room(house, "Hall")
    with pytest.raises(claims.ClaimLockedError):
        await layout.update_room(kitchen, name="Galley")
    with pytest.raises(claims.ClaimLockedError):
        await service.delete_structure(
            db_session, organization_id, layout.claim_id, house.id, user=layout.user
        )
    assert await layout.plan() == {"Main house": ["Kitchen"]}


async def test_deleted_and_foreign_claims_are_not_found(
    db_session: AsyncSession, organization_id: UUID, user: User, claim: Claim, layout: Layout
) -> None:
    house = await layout.structure("Main house")
    other = Layout(
        db_session, organization_id, (await new_claim(db_session, organization_id, user)).id, user
    )

    # A structure is only reachable through its own claim.
    with pytest.raises(NotFoundError, match="Structure not found"):
        await other.room(house, "Kitchen")

    claim.soft_delete()
    await db_session.commit()
    with pytest.raises(NotFoundError, match="Claim not found"):
        await layout.plan()
    with pytest.raises(NotFoundError, match="Claim not found"):
        await layout.structure("Garage")


async def test_a_room_cannot_sit_in_another_claims_structure(
    db_session: AsyncSession, organization_id: UUID, user: User, layout: Layout
) -> None:
    house = await layout.structure("Main house")
    other = await new_claim(db_session, organization_id, user)

    db_session.add(
        Room(organization_id=organization_id, claim_id=other.id, structure_id=house.id, name="X")
    )
    with pytest.raises(IntegrityError, match="fk_rooms_claim_id_structures"):
        await db_session.flush()
