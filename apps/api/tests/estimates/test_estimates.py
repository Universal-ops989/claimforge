"""Estimates: numbering, lines copied from the price list, order, rooms, and approval."""

from decimal import Decimal
from typing import Any
from uuid import UUID

import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tests.moisture.conftest import Map, open_map

from claimforge_api.audit.models import AuditEvent
from claimforge_api.claims import service as claims
from claimforge_api.claims.schemas import ClaimStatusChangeCreate
from claimforge_api.core.errors import PermissionDeniedError
from claimforge_api.estimates import service
from claimforge_api.estimates.models import Estimate, EstimateStatus
from claimforge_api.estimates.schemas import EstimateCreate, LineCreate, LineUpdate
from claimforge_api.organizations import service as organizations
from claimforge_api.organizations.schemas import OrganizationCreate
from claimforge_api.pricing import service as pricing
from claimforge_api.pricing.models import PriceItem, PriceList
from claimforge_api.pricing.schemas import PriceItemCreate, PriceItemUpdate, PriceListCreate
from claimforge_api.structures import service as structures
from claimforge_api.users import service as users
from claimforge_api.users.models import Membership, Role, User

D = Decimal


class Desk:
    """A claim, its price list, and an estimator."""

    def __init__(self, moisture_map: Map, price_list: PriceList, items: dict[str, PriceItem]):
        self.map, self.price_list, self.items = moisture_map, price_list, items
        self.session: AsyncSession = moisture_map.session
        self.org, self.claim_id, self.user = (
            moisture_map.organization_id,
            moisture_map.claim.id,
            moisture_map.user,
        )

    def by(self, user: User) -> "Desk":
        clone = Desk(self.map, self.price_list, self.items)
        clone.user = user
        return clone

    async def estimate(self, title: str = "Mitigation", **fields: Any) -> Estimate:
        return await service.create_estimate(
            self.session,
            self.org,
            self.claim_id,
            EstimateCreate.model_validate({"title": title} | fields),
            user=self.user,
        )

    async def add(self, estimate: Estimate, **fields: Any) -> Estimate:
        return await service.add_line(
            self.session,
            self.org,
            self.claim_id,
            estimate.id,
            LineCreate.model_validate(fields),
            user=self.user,
        )

    async def edit(self, estimate: Estimate, line_id: UUID, **fields: Any) -> Estimate:
        return await service.update_line(
            self.session,
            self.org,
            self.claim_id,
            estimate.id,
            line_id,
            LineUpdate.model_validate(fields),
            user=self.user,
        )

    async def move(self, estimate: Estimate, status: str) -> Estimate:
        return await service.change_status(
            self.session,
            self.org,
            self.claim_id,
            estimate.id,
            EstimateStatus(status),
            user=self.user,
        )


@pytest.fixture
async def desk(moisture_map: Map) -> Desk:
    price_list = await pricing.create_price_list(
        moisture_map.session,
        moisture_map.organization_id,
        PriceListCreate(name="TX Austin Nov 2026", is_default=True),
        user=moisture_map.user,
    )
    items = {}
    for code, unit, price in (("WTR DHM", "DA", "123.40"), ("DRY 1/2", "SF", "12.35")):
        items[code] = await pricing.create_item(
            moisture_map.session,
            moisture_map.organization_id,
            price_list.id,
            PriceItemCreate.model_validate(
                {"code": code, "description": f"{code} work", "unit": unit, "unit_price": price}
            ),
            user=moisture_map.user,
        )
    return Desk(moisture_map, price_list, items)


async def member(desk: Desk, role: Role) -> User:
    person = await users.create_user(desk.session, email=f"{role}@example.com", full_name=role)
    desk.session.add(Membership(organization_id=desk.org, user_id=person.id, role=role))
    await desk.session.commit()
    return person


def lines(estimate: Estimate) -> list[tuple[int, str, str]]:
    return [(ln.position, ln.code or "-", f"{ln.total}") for ln in estimate.lines]


async def test_numbered_and_priced_from_the_default(desk: Desk) -> None:
    first = await desk.estimate()
    second = await desk.estimate("Repairs")

    assert (first.number, second.number) == (1, 2)
    assert first.price_list_id == desk.price_list.id
    assert service.present(first).next_statuses == ["submitted"]

    theirs = await organizations.create_organization(
        desk.session, OrganizationCreate(name="Theirs"), owner=desk.user
    )
    foreign = await pricing.create_price_list(
        desk.session, theirs.id, PriceListCreate(name="Theirs"), user=desk.user
    )
    with pytest.raises(service.UnknownPriceListError):
        await desk.estimate(price_list_id=str(foreign.id))


async def test_lines_copy_their_prices(desk: Desk) -> None:
    estimate = await desk.estimate()
    dehu = desk.items["WTR DHM"]

    estimate = await desk.add(estimate, price_item_id=str(dehu.id), quantity="3")
    estimate = await desk.add(
        estimate, description="Haul debris", unit="ea", unit_price="250", quantity="1"
    )
    estimate = await desk.add(
        estimate, price_item_id=str(desk.items["DRY 1/2"].id), quantity="3.33"
    )

    assert lines(estimate) == [
        (1, "WTR DHM", "370.20"),
        (2, "-", "250.00"),
        (3, "DRY 1/2", "41.13"),
    ]
    # 3.33 * 12.35 = 41.1255: to the cent, half up.

    # Repricing the list, or deleting it, leaves the estimate as it was.
    await pricing.update_item(
        desk.session,
        desk.org,
        desk.price_list.id,
        dehu.id,
        PriceItemUpdate.model_validate({"unit_price": "999"}),
        user=desk.user,
    )
    await pricing.delete_price_list(desk.session, desk.org, desk.price_list.id, user=desk.user)
    kept = await service.get_estimate(
        desk.session, desk.org, desk.claim_id, estimate.id, user=desk.user
    )
    assert lines(kept)[0] == (1, "WTR DHM", "370.20")
    assert (kept.price_list_id, kept.lines[0].price_item_id) == (None, None)


def test_a_line_comes_from_one_place() -> None:
    item = "0192f3a4-5b6c-7d8e-9f01-000000000001"
    for body in (
        {"price_item_id": item, "quantity": "1", "unit_price": "5"},  # item and price
        {"description": "Hand", "unit": "EA", "quantity": "1"},  # no price
        {"price_item_id": item, "quantity": "0"},
        {"price_item_id": item, "quantity": "1.234"},
    ):
        with pytest.raises(ValidationError):
            LineCreate.model_validate(body)


async def test_order(desk: Desk) -> None:
    estimate = await desk.estimate()
    for code in ("A", "B", "C"):
        estimate = await desk.add(
            estimate, code=code, description=code, unit="EA", unit_price="1", quantity="1"
        )
    estimate = await desk.add(
        estimate, code="FIRST", description="x", unit="EA", unit_price="1", quantity="1", position=1
    )
    assert [ln.code for ln in estimate.lines] == ["FIRST", "A", "B", "C"]

    c = estimate.lines[3]
    estimate = await desk.edit(estimate, c.id, position=2)
    assert [ln.code for ln in estimate.lines] == ["FIRST", "C", "A", "B"]
    estimate = await desk.edit(estimate, c.id, position=99)  # past the end: last
    assert [ln.code for ln in estimate.lines] == ["FIRST", "A", "B", "C"]

    estimate = await service.delete_line(
        desk.session, desk.org, desk.claim_id, estimate.id, estimate.lines[0].id, user=desk.user
    )
    assert [(ln.position, ln.code) for ln in estimate.lines] == [(1, "A"), (2, "B"), (3, "C")]


async def test_rooms(desk: Desk) -> None:
    kitchen = await desk.map.room("Kitchen")
    estimate = await desk.estimate()
    estimate = await desk.add(
        estimate, price_item_id=str(desk.items["WTR DHM"].id), quantity="1", room_id=str(kitchen.id)
    )
    line = estimate.lines[0]
    assert line.room is not None
    assert line.room.name == "Kitchen"

    elsewhere = await open_map(desk.session, desk.org, desk.user)
    their_room = await elsewhere.room("Garage")
    with pytest.raises(service.UnknownRoomError):
        await desk.edit(estimate, line.id, room_id=str(their_room.id))

    await structures.delete_room(desk.session, desk.org, desk.claim_id, kitchen.id, user=desk.user)
    kept = await service.get_estimate(
        desk.session, desk.org, desk.claim_id, estimate.id, user=desk.user
    )
    assert kept.lines[0].room_id is None


async def test_approval(desk: Desk) -> None:
    estimate = await desk.estimate()
    with pytest.raises(service.EstimateTransitionError, match="at least one line"):
        await desk.move(estimate, "submitted")
    estimate = await desk.add(estimate, price_item_id=str(desk.items["WTR DHM"].id), quantity="2")

    submitted = await desk.move(estimate, "submitted")
    assert service.present(submitted).next_statuses == ["draft", "approved", "rejected"]
    with pytest.raises(service.EstimateNotDraftError):
        await desk.add(estimate, price_item_id=str(desk.items["WTR DHM"].id), quantity="1")
    with pytest.raises(service.EstimateNotDraftError):
        await service.delete_estimate(
            desk.session, desk.org, desk.claim_id, estimate.id, user=desk.user
        )
    with pytest.raises(service.EstimateTransitionError) as caught:
        await desk.move(estimate, "submitted")
    assert caught.value.extra == {"allowed": ["draft", "approved", "rejected"]}

    rejected = await desk.move(estimate, "rejected")
    reworked = await desk.move(rejected, "draft")
    await desk.move(reworked, "submitted")
    approved = await desk.move(reworked, "approved")
    assert approved.status == "approved"


async def test_who_may_do_what(desk: Desk) -> None:
    technician = await member(desk, Role.TECHNICIAN)
    viewer = await member(desk, Role.VIEWER)
    estimate = await desk.estimate()
    estimate = await desk.add(estimate, price_item_id=str(desk.items["WTR DHM"].id), quantity="2")

    with pytest.raises(PermissionDeniedError):
        await desk.by(technician).estimate()
    with pytest.raises(PermissionDeniedError):
        await desk.by(viewer).move(estimate, "submitted")
    assert (
        len(await service.list_estimates(desk.session, desk.org, desk.claim_id, user=viewer)) == 1
    )


async def test_closed_claims_and_the_record(desk: Desk) -> None:
    estimate = await desk.estimate()
    estimate = await desk.add(estimate, price_item_id=str(desk.items["WTR DHM"].id), quantity="2")
    await claims.change_status(
        desk.session,
        desk.org,
        desk.claim_id,
        ClaimStatusChangeCreate.model_validate({"status": "cancelled", "reason": "Duplicate"}),
        user=desk.user,
    )
    with pytest.raises(claims.ClaimLockedError):
        await desk.estimate()

    actions = sorted(
        await desk.session.scalars(
            select(AuditEvent.action).where(
                AuditEvent.entity_type.in_(["estimate", "estimate_line"])
            )
        )
    )
    assert actions == ["estimate.created", "estimate_line.created"]
