"""Listing claims: filters, sort orders, search and what a list row shows."""

from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID

import pytest
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.claims import service
from claimforge_api.claims.models import Claim, ClaimStatus
from claimforge_api.claims.models import ClaimContactRole as Role
from claimforge_api.claims.schemas import ClaimCreate, ClaimListQuery, ClaimSort
from claimforge_api.contacts import service as contacts
from claimforge_api.contacts.models import Contact
from claimforge_api.contacts.schemas import ContactCreate
from claimforge_api.db.pagination import InvalidCursorError
from claimforge_api.users.models import User

AUSTIN = {"line1": "123 Main St", "city": "Austin", "region": "TX", "postal_code": "78701"}
DALLAS = {"line1": "9 Elm Ave", "city": "Dallas", "region": "TX", "postal_code": "75201"}


class Book:
    """A small claim book: who, where, what and when, varied enough to filter on."""

    def __init__(self, session: AsyncSession, organization_id: UUID, user: User) -> None:
        self.session, self.organization_id, self.user = session, organization_id, user

    async def contact(self, name: str) -> Contact:
        return await contacts.create_contact(
            self.session, self.organization_id, ContactCreate(full_name=name), user=self.user
        )

    async def claim(self, *, status: ClaimStatus = ClaimStatus.NEW, **fields: Any) -> Claim:
        body = {"loss_type": "water", "property": {"address": AUSTIN}} | fields
        claim = await service.create_claim(
            self.session,
            self.organization_id,
            ClaimCreate.model_validate(body),
            user=self.user,
        )
        if status is not ClaimStatus.NEW:  # No status workflow yet (roadmap item 68).
            claim.status = status
            await self.session.commit()
        return claim

    async def numbers(self, limit: int = 100, **filters: Any) -> list[str]:
        page = await service.list_claims(
            self.session,
            self.organization_id,
            ClaimListQuery.model_validate(filters),
            user=self.user,
            limit=limit,
            cursor=None,
        )
        return [claim.number for claim in page.items]


@pytest.fixture
def book(db_session: AsyncSession, organization_id: UUID, user: User) -> Book:
    return Book(db_session, organization_id, user)


def tail(number: str) -> int:
    """2026-00003 -> 3, to keep expectations short."""
    return int(number.rsplit("-", 1)[1])


async def test_rows_show_the_property_and_the_primary_contact(book: Book) -> None:
    dana = await book.contact("Dana Whitfield")
    riley = await book.contact("Riley Tran")
    await book.claim(
        contacts=[
            {"contact_id": str(riley.id), "role": "tenant"},
            {"contact_id": str(dana.id), "role": "insured", "is_primary": True},
        ]
    )
    await book.claim(property={"address": DALLAS})

    page = await service.list_claims(
        book.session, book.organization_id, ClaimListQuery(), user=book.user, limit=10, cursor=None
    )

    newest, first = page.items
    assert newest.property.city == "Dallas"
    assert newest.primary_contact is None
    assert first.primary_contact is not None
    assert (first.primary_contact.contact.full_name, first.primary_contact.role) == (
        "Dana Whitfield",
        Role.INSURED,
    )


async def test_sort_orders(book: Book) -> None:
    await book.claim(loss_date="2026-03-01")  # 1
    await book.claim()  # 2: loss date unknown
    third = await book.claim(loss_date="2026-01-15")  # 3
    await book.claim(loss_date="2026-03-01")  # 4: same day as 1
    # Every write in one test shares a transaction timestamp, so set this one apart.
    third.updated_at = datetime(2099, 1, 1, tzinfo=UTC)
    await book.session.commit()

    async def order(sort: ClaimSort) -> list[int]:
        return [tail(n) for n in await book.numbers(sort=sort)]

    assert await order(ClaimSort.NEWEST) == [4, 3, 2, 1]
    assert await order(ClaimSort.OLDEST) == [1, 2, 3, 4]
    assert (await order(ClaimSort.RECENTLY_UPDATED))[0] == 3
    # Unknown loss dates count as later than any date.
    assert await order(ClaimSort.LOSS_DATE_DESC) == [2, 4, 1, 3]
    assert await order(ClaimSort.LOSS_DATE_ASC) == [3, 1, 4, 2]


async def test_filters_combine(book: Book) -> None:
    dana = await book.contact("Dana")
    await book.claim(loss_type="fire", loss_date="2026-02-10")  # 1
    await book.claim(  # 2
        status=ClaimStatus.IN_PROGRESS,
        loss_date="2026-05-01",
        contacts=[{"contact_id": str(dana.id), "role": "insured"}],
    )
    dallas = await book.claim(  # 3
        status=ClaimStatus.ON_HOLD,
        loss_type="mold",
        property={"address": DALLAS},
        contacts=[{"contact_id": str(dana.id), "role": "tenant"}],
    )
    await book.claim(status=ClaimStatus.CLOSED, loss_date="2026-06-30")  # 4

    async def found(**filters: Any) -> set[int]:
        return {tail(n) for n in await book.numbers(**filters)}

    assert await found() == {1, 2, 3, 4}
    assert await found(status=["in_progress", "on_hold"]) == {2, 3}
    assert await found(loss_type=["fire", "mold"]) == {1, 3}
    assert await found(property_id=dallas.property_id) == {3}
    assert await found(contact_id=dana.id) == {2, 3}
    assert await found(contact_id=dana.id, status=["on_hold"]) == {3}
    # Date bounds are inclusive; claims with no loss date never match a date range.
    assert await found(loss_date_from="2026-05-01") == {2, 4}
    assert await found(loss_date_to="2026-05-01") == {1, 2}
    assert await found(loss_date_from="2026-02-10", loss_date_to="2026-02-10") == {1}


@pytest.mark.parametrize(
    ("q", "expected"),
    [
        ("00002", {2}),  # claim number
        ("lone star", {1}),  # carrier name, any case
        ("LSM-88", {1}),  # carrier claim number
        ("HO3-77", {2}),  # policy number
        ("elm ave", {3}),  # street, as normalized
        ("dallas", {3}),  # city
        ("787", {1, 2}),  # postal code
        ("whitfield", {2}),  # a linked contact's name
        ("100%", set()),  # wildcards are literal
    ],
)
async def test_search(book: Book, q: str, expected: set[int]) -> None:
    dana = await book.contact("Dana Whitfield")
    await book.claim(carrier_name="Lone Star Mutual", carrier_claim_number="LSM-88213")
    await book.claim(
        policy_number="HO3-7741", contacts=[{"contact_id": str(dana.id), "role": "insured"}]
    )
    await book.claim(property={"address": DALLAS})

    assert {tail(n) for n in await book.numbers(q=q)} == expected


async def test_deleted_claims_are_left_out(book: Book) -> None:
    await book.claim()
    gone = await book.claim()
    gone.soft_delete()
    await book.session.commit()

    assert [tail(n) for n in await book.numbers()] == [1]


async def test_pages_through_a_loss_date_sort(book: Book) -> None:
    for loss_date in ["2026-04-01", None, "2026-02-01", None, "2026-04-01", "2026-03-01"]:
        await book.claim(loss_date=loss_date)

    seen: list[Claim] = []
    cursor = None
    while True:
        page = await service.list_claims(
            book.session,
            book.organization_id,
            ClaimListQuery(sort=ClaimSort.LOSS_DATE_DESC),
            user=book.user,
            limit=2,
            cursor=cursor,
        )
        seen += page.items
        if not page.has_more:
            break
        cursor = page.next_cursor

    assert [c.loss_date for c in seen] == [
        None,
        None,
        date(2026, 4, 1),
        date(2026, 4, 1),
        date(2026, 3, 1),
        date(2026, 2, 1),
    ]
    assert len({c.id for c in seen}) == 6

    # A cursor only continues the sort it came from.
    with pytest.raises(InvalidCursorError):
        await service.list_claims(
            book.session,
            book.organization_id,
            ClaimListQuery(sort=ClaimSort.LOSS_DATE_ASC),
            user=book.user,
            limit=2,
            cursor=cursor,
        )


def test_a_reversed_date_range_is_rejected() -> None:
    with pytest.raises(ValidationError, match="must not be after"):
        ClaimListQuery(loss_date_from=date(2026, 5, 2), loss_date_to=date(2026, 5, 1))


def test_query_defaults() -> None:
    query = ClaimListQuery(q="   ")

    assert query.sort is ClaimSort.NEWEST
    assert (query.status, query.loss_type, query.q) == ([], [], "")
