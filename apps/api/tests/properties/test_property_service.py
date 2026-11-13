from typing import Any
from uuid import UUID

import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.audit.models import AuditEvent
from claimforge_api.core.errors import NotFoundError, PermissionDeniedError
from claimforge_api.properties import service
from claimforge_api.properties.models import Property, PropertyType
from claimforge_api.properties.schemas import PropertyCreate, PropertyUpdate
from claimforge_api.users import service as users
from claimforge_api.users.models import Membership, Role, User

AUSTIN = {"city": "Austin", "region": "TX", "postal_code": "78701"}


def body(line1: str = "123 Main St", **fields: Any) -> dict[str, Any]:
    address = AUSTIN | {"line1": line1} | fields.pop("address", {})
    return {"address": address} | fields


async def add(
    session: AsyncSession,
    organization_id: UUID,
    user: User,
    line1: str = "123 Main St",
    **fields: Any,
) -> Property:
    data = PropertyCreate.model_validate(body(line1, **fields))
    return await service.create_property(session, organization_id, data, user=user)


async def streets(
    session: AsyncSession, organization_id: UUID, user: User, **filters: str
) -> list[str]:
    page = await service.list_properties(
        session, organization_id, user=user, limit=100, cursor=None, **filters
    )
    return [p.address_line1 for p in page.items]


async def member(session: AsyncSession, organization_id: UUID, role: Role) -> User:
    person = await users.create_user(session, email=f"{role}@example.com", full_name=str(role))
    session.add(Membership(organization_id=organization_id, user_id=person.id, role=role))
    await session.commit()
    return person


async def test_create_stores_the_normalized_address(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    prop = await add(
        db_session,
        organization_id,
        user,
        "123 north main street apt 4b",
        address={"city": "AUSTIN", "region": "texas", "postal_code": "787011234"},
        year_built=1962,
        latitude=30.2672,
        longitude=-97.7431,
        access_notes="Lockbox on the side gate, code 2468. Dog in the yard.",
    )

    assert prop.address.formatted == "123 N Main St Apt 4B, Austin, TX 78701-1234"
    assert prop.address_key == "us|78701|123 n main st|apt 4b"
    assert prop.property_type == PropertyType.RESIDENTIAL
    assert (prop.latitude, prop.longitude) == (30.2672, -97.7431)


async def test_the_same_address_spelled_differently_is_a_duplicate(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    first = await add(
        db_session, organization_id, user, "123 N Main St", address={"line2": "Apt 4B"}
    )

    with pytest.raises(service.PropertyExistsError) as caught:
        await add(db_session, organization_id, user, "123 north main street apartment 4b")

    assert caught.value.extra == {"existing_property_id": str(first.id)}
    # Another unit in the same building is another property.
    await add(db_session, organization_id, user, "123 N Main St", address={"line2": "Apt 5"})


async def test_a_deleted_propertys_address_can_be_reused(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    first = await add(db_session, organization_id, user)
    await service.delete_property(db_session, organization_id, first.id, user=user)

    again = await add(db_session, organization_id, user)

    assert again.id != first.id


async def test_moving_onto_an_existing_address_conflicts(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    main = await add(db_session, organization_id, user, "123 Main St")
    oak = await add(db_session, organization_id, user, "9 Oak Ln")

    with pytest.raises(service.PropertyExistsError):
        await service.update_property(
            db_session,
            organization_id,
            oak.id,
            PropertyUpdate.model_validate(body("123 main street")),
            user=user,
        )
    # Respelling a property's own address is not a conflict.
    respelled = await service.update_property(
        db_session,
        organization_id,
        main.id,
        PropertyUpdate.model_validate(body("123 MAIN STREET")),
        user=user,
    )
    assert respelled.address_line1 == "123 Main St"


async def test_update_changes_and_clears_only_given_fields(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    prop = await add(
        db_session, organization_id, user, year_built=1950, latitude=30.0, longitude=-97.0
    )

    updated = await service.update_property(
        db_session,
        organization_id,
        prop.id,
        PropertyUpdate.model_validate(
            {"property_type": "multi_family", "latitude": None, "longitude": None}
        ),
        user=user,
    )

    assert updated.property_type == PropertyType.MULTI_FAMILY
    assert (updated.latitude, updated.longitude) == (None, None)
    assert updated.year_built == 1950
    assert updated.address_line1 == "123 Main St"


@pytest.mark.parametrize(
    ("data", "message"),
    [
        (body("P.O. Box 12"), "not a PO box"),
        (body(latitude=30.0), "given together"),
        (body(year_built=2999), "in the future"),
        (body(year_built=1200), "greater than or equal to 1600"),
        (body(property_type="castle"), "property_type"),
    ],
)
def test_create_rejects_invalid_input(data: dict[str, Any], message: str) -> None:
    with pytest.raises(ValidationError, match=message):
        PropertyCreate.model_validate(data)


@pytest.mark.parametrize(
    ("data", "message"),
    [
        ({"address": None}, "address cannot be cleared"),
        ({"property_type": None}, "property_type cannot be cleared"),
        ({"latitude": 30.0}, "changed together"),
        ({"latitude": None, "longitude": -97.0}, "changed together"),
    ],
)
def test_update_rejects_inconsistent_changes(data: dict[str, Any], message: str) -> None:
    with pytest.raises(ValidationError, match=message):
        PropertyUpdate.model_validate(data)


async def test_list_is_newest_first_and_filterable(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    await add(db_session, organization_id, user, "1 First St")
    await add(db_session, organization_id, user, "2 Second St", address={"postal_code": "78702"})
    await add(
        db_session,
        organization_id,
        user,
        "3 Third St",
        address={"city": "Round Rock", "postal_code": "78664"},
    )

    assert await streets(db_session, organization_id, user) == [
        "3 Third St",
        "2 Second St",
        "1 First St",
    ]
    assert await streets(db_session, organization_id, user, postal_code="7870") == [
        "2 Second St",
        "1 First St",
    ]
    assert await streets(db_session, organization_id, user, q="round rock") == ["3 Third St"]
    assert await streets(db_session, organization_id, user, q="second") == ["2 Second St"]


async def test_roles(db_session: AsyncSession, organization_id: UUID, user: User) -> None:
    prop = await add(db_session, organization_id, user)
    viewer = await member(db_session, organization_id, Role.VIEWER)
    adjuster = await member(db_session, organization_id, Role.ADJUSTER)
    admin = await member(db_session, organization_id, Role.ADMIN)
    outsider = await users.create_user(db_session, email="out@example.com", full_name="Out")

    assert (
        await service.get_property(db_session, organization_id, prop.id, user=viewer)
    ).id == prop.id
    with pytest.raises(PermissionDeniedError):
        await add(db_session, organization_id, viewer, "5 Viewer Way")

    await add(db_session, organization_id, adjuster, "6 Adjuster Ave")
    with pytest.raises(PermissionDeniedError):
        await service.delete_property(db_session, organization_id, prop.id, user=adjuster)

    await service.delete_property(db_session, organization_id, prop.id, user=admin)
    with pytest.raises(NotFoundError):
        await service.get_property(db_session, organization_id, prop.id, user=outsider)


async def test_changes_are_audited_as_property_events(
    db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    prop = await add(db_session, organization_id, user)
    await service.update_property(
        db_session,
        organization_id,
        prop.id,
        PropertyUpdate.model_validate({"year_built": 1975}),
        user=user,
    )

    rows = await db_session.scalars(
        select(AuditEvent).where(AuditEvent.entity_id == prop.id).order_by(AuditEvent.id)
    )
    created, updated = rows
    assert (created.action, updated.action) == ("property.created", "property.updated")
    assert created.organization_id == organization_id
    assert created.changes["address_line1"] == [None, "123 Main St"]
    assert updated.changes == {"year_built": [None, 1975]}


async def test_a_lost_race_on_the_unique_index_is_still_a_conflict(
    db_session: AsyncSession, organization_id: UUID, user: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    first_id = (await add(db_session, organization_id, user)).id
    lookup = service._existing_at
    calls = 0

    async def miss_once(*args: Any) -> UUID | None:
        """The pre-check misses, as if the other request committed just after it ran."""
        nonlocal calls
        calls += 1
        return None if calls == 1 else await lookup(*args)

    monkeypatch.setattr(service, "_existing_at", miss_once)

    with pytest.raises(service.PropertyExistsError) as caught:
        await add(db_session, organization_id, user)

    assert caught.value.extra == {"existing_property_id": str(first_id)}
    # The rollback expired everything the session had loaded, including the test's user.
    await db_session.refresh(user)
    assert await streets(db_session, organization_id, user) == ["123 Main St"]
