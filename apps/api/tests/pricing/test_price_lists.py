"""Price lists and items: defaults, unique names and codes, money as strings, access."""

from typing import Any
from uuid import UUID

import httpx2
import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from tests.conftest import ClientFor

from claimforge_api.audit.models import AuditEvent
from claimforge_api.pricing.models import PriceList
from claimforge_api.users.models import Role


@pytest.fixture
def url(organization_id: UUID) -> str:
    return f"/v1/organizations/{organization_id}/price-lists"


async def send(
    client: httpx2.AsyncClient, method: str, url: str, expect: int = 0, **body: Any
) -> Any:
    response = await client.request(method, url, json=body if body else None)
    if expect:
        assert response.status_code == expect, response.text
    else:
        assert response.status_code < 300, response.text
    return response.json() if response.content else None


async def item(
    client: httpx2.AsyncClient, list_url: str, code: str, price: str | float = "10", **fields: Any
) -> dict[str, Any]:
    body = {"code": code, "description": f"{code} work", "unit": "EA", "unit_price": price}
    created: dict[str, Any] = await send(client, "POST", f"{list_url}/items", **(body | fields))
    return created


async def test_one_default_at_a_time(auth_client: httpx2.AsyncClient, url: str) -> None:
    first = await send(auth_client, "POST", url, name="TX Austin Oct 2026", is_default=True)
    second = await send(
        auth_client,
        "POST",
        url,
        name="TX Austin Nov 2026",
        is_default=True,
        effective_on="2026-11-01",
    )
    await send(auth_client, "POST", url, name="Archive")

    listed = await send(auth_client, "GET", url)
    assert [(lst["name"], lst["is_default"]) for lst in listed] == [
        ("TX Austin Nov 2026", True),
        ("Archive", False),
        ("TX Austin Oct 2026", False),
    ]
    assert second["effective_on"] == "2026-11-01"
    back = await send(auth_client, "PATCH", f"{url}/{first['id']}", is_default=True)
    assert back["is_default"] is True
    again = await send(auth_client, "GET", f"{url}/{second['id']}")
    assert again["is_default"] is False


async def test_the_database_keeps_one_default(
    db_session: AsyncSession, organization_id: UUID
) -> None:
    for name in ("A", "B"):
        db_session.add(PriceList(organization_id=organization_id, name=name, is_default=True))
    with pytest.raises(IntegrityError, match="uq_price_lists_default"):
        await db_session.flush()
    await db_session.rollback()


async def test_names_and_codes_are_unique(auth_client: httpx2.AsyncClient, url: str) -> None:
    first = await send(auth_client, "POST", url, name="Main")
    other = await send(auth_client, "POST", url, name="Other")
    taken = await send(auth_client, "POST", url, 409, name="main")
    assert taken["code"] == "price_list_name_taken"
    renamed = await send(auth_client, "PATCH", f"{url}/{other['id']}", 409, name="MAIN")
    assert renamed["code"] == "price_list_name_taken"

    list_url = f"{url}/{first['id']}"
    await item(auth_client, list_url, "WTR DHM")
    duplicate = await send(
        auth_client,
        "POST",
        f"{list_url}/items",
        409,
        code="wtr dhm",
        description="x",
        unit="EA",
        unit_price="1",
    )
    assert duplicate["code"] == "price_code_taken"
    # The same code on another list is fine.
    await item(auth_client, f"{url}/{other['id']}", "WTR DHM")


async def test_items(auth_client: httpx2.AsyncClient, url: str) -> None:
    price_list = await send(auth_client, "POST", url, name="Main")
    list_url = f"{url}/{price_list['id']}"

    dehu = await item(auth_client, list_url, "WTR DHM", "123.4", unit=" da ", category="WTR")
    assert (dehu["unit"], dehu["unit_price"], dehu["category"]) == ("DA", "123.40", "WTR")
    await item(auth_client, list_url, "WTR DRYAM", 33.5, category="WTR")  # a number works too
    await item(auth_client, list_url, "DRY 1/2", "2.15", unit="SF", category="DRY")

    page = await send(auth_client, "GET", f"{list_url}/items")
    assert [i["code"] for i in page["items"]] == ["DRY 1/2", "WTR DHM", "WTR DRYAM"]
    by_category = await auth_client.get(f"{list_url}/items", params={"category": "wtr"})
    assert [i["code"] for i in by_category.json()["items"]] == ["WTR DHM", "WTR DRYAM"]
    found = await auth_client.get(f"{list_url}/items", params={"q": "dryam"})
    assert [i["code"] for i in found.json()["items"]] == ["WTR DRYAM"]
    first_page = await auth_client.get(f"{list_url}/items", params={"limit": 2})
    assert first_page.json()["has_more"] is True
    assert (await send(auth_client, "GET", f"{url}/{price_list['id']}"))["item_count"] == 3

    repriced = await send(
        auth_client, "PATCH", f"{list_url}/items/{dehu['id']}", unit_price="130", category=None
    )
    assert (repriced["unit_price"], repriced["category"]) == ("130.00", None)
    bad: list[dict[str, Any]] = [
        {"unit_price": "-1"},
        {"unit_price": "1.005"},
        {"unit": "S F"},
        {"unit": "SQUAREFEETX"},
        {"code": None},
    ]
    for body in bad:
        response = await auth_client.patch(f"{list_url}/items/{dehu['id']}", json=body)
        assert response.status_code == 422, body

    await send(auth_client, "DELETE", f"{list_url}/items/{dehu['id']}", 204)
    assert (await send(auth_client, "GET", f"{url}/{price_list['id']}"))["item_count"] == 2


async def test_deleting_a_list_takes_its_items(
    auth_client: httpx2.AsyncClient, url: str, db_session: AsyncSession
) -> None:
    price_list = await send(auth_client, "POST", url, name="Main")
    list_url = f"{url}/{price_list['id']}"
    await item(auth_client, list_url, "A")
    await item(auth_client, list_url, "B")

    await send(auth_client, "DELETE", list_url, 204)

    assert (await auth_client.get(f"{list_url}/items")).status_code == 404
    events = list(
        await db_session.scalars(
            select(AuditEvent.action).where(
                AuditEvent.entity_type.in_(["price_list", "price_item"])
            )
        )
    )
    # Lists are audited; items, which imports bring by the thousand, aren't.
    assert sorted(events) == ["price_list.created", "price_list.deleted"]


async def test_access(
    auth_client: httpx2.AsyncClient, client_for: ClientFor, url: str, db_session: AsyncSession
) -> None:
    price_list = await send(auth_client, "POST", url, name="Main")
    technician = await client_for(Role.TECHNICIAN)
    adjuster = await client_for(Role.ADJUSTER)
    viewer = await client_for(Role.VIEWER)

    assert len(await send(viewer, "GET", url)) == 1
    await send(technician, "POST", url, 403, name="Mine")
    await item(adjuster, f"{url}/{price_list['id']}", "WTR DHM")
    count = await db_session.scalar(select(func.count()).select_from(PriceList))
    assert count == 1
