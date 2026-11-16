"""Organization default rates for new estimates, and estimates' subtotals by room."""

from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

import httpx2
from tests.conftest import ClientFor

from claimforge_api.estimates import totals
from claimforge_api.users.models import Role

ADDRESS = {"line1": "123 Main St", "city": "Austin", "region": "TX", "postal_code": "78701"}
D = Decimal


async def send(
    client: httpx2.AsyncClient, method: str, url: str, expect: int = 0, **body: Any
) -> Any:
    response = await client.request(method, url, json=body if body else None)
    if expect:
        assert response.status_code == expect, response.text
    else:
        assert response.status_code < 300, response.text
    return response.json() if response.content else None


async def claim_url(client: httpx2.AsyncClient, base: str) -> str:
    claim = await send(
        client, "POST", f"{base}/claims", loss_type="water", property={"address": ADDRESS}
    )
    return f"{base}/claims/{claim['id']}"


async def test_new_estimates_start_from_the_organizations_rates(
    auth_client: httpx2.AsyncClient, client_for: ClientFor, organization_id: UUID
) -> None:
    base = f"/v1/organizations/{organization_id}"
    org = await send(
        auth_client,
        "PATCH",
        base,
        default_tax_percent="8.25",
        default_overhead_percent=10,
        default_profit_percent="10",
    )
    assert (org["default_tax_percent"], org["default_overhead_percent"]) == ("8.25", "10")
    url = f"{await claim_url(auth_client, base)}/estimates"

    defaulted = await send(auth_client, "POST", url, title="Mitigation")
    assert (
        defaulted["tax_percent"],
        defaulted["overhead_percent"],
        defaulted["profit_percent"],
    ) == (
        "8.25",
        "10",
        "10",
    )
    # An explicit rate wins, zero included.
    chosen = await send(
        auth_client, "POST", url, title="Contents", tax_percent="0", profit_percent="12.5"
    )
    assert (chosen["tax_percent"], chosen["overhead_percent"], chosen["profit_percent"]) == (
        "0",
        "10",
        "12.5",
    )

    adjuster = await client_for(Role.ADJUSTER)
    assert (await adjuster.patch(base, json={"default_tax_percent": "5"})).status_code == 403
    assert (await auth_client.patch(base, json={"default_tax_percent": "101"})).status_code == 422


def test_subtotals_by_room() -> None:
    kitchen, bath = uuid4(), uuid4()
    groups = totals.by_room(
        [(None, D("5.00")), (kitchen, D("10.00")), (bath, D("2.50")), (kitchen, D("0.10"))]
    )

    assert [(g.room_id, g.lines, g.subtotal) for g in groups] == [
        (kitchen, 2, D("10.10")),
        (bath, 1, D("2.50")),
        (None, 1, D("5.00")),
    ]
    assert totals.by_room([]) == []


async def test_room_subtotals_on_an_estimate(
    auth_client: httpx2.AsyncClient, organization_id: UUID
) -> None:
    claim = await claim_url(auth_client, f"/v1/organizations/{organization_id}")
    house = await send(auth_client, "POST", f"{claim}/structures", name="House")
    rooms = f"{claim}/structures/{house['id']}/rooms"
    kitchen = await send(auth_client, "POST", rooms, name="Kitchen")
    bath = await send(auth_client, "POST", rooms, name="Bath")
    estimate = await send(auth_client, "POST", f"{claim}/estimates", title="Repairs")
    lines = f"{claim}/estimates/{estimate['id']}/lines"
    for room, price in ((kitchen, "100"), (bath, "40"), (None, "15"), (kitchen, "60")):
        estimate = await send(
            auth_client,
            "POST",
            lines,
            description="Work",
            unit="EA",
            unit_price=price,
            quantity="1",
            room_id=room["id"] if room else None,
        )

    assert [
        ((group["room"] or {}).get("name"), group["lines"], group["subtotal"])
        for group in estimate["rooms"]
    ] == [("Kitchen", 2, "160.00"), ("Bath", 1, "40.00"), (None, 1, "15.00")]
