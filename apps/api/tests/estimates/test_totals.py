"""Estimate totals: tax on taxable lines, then overhead and profit, every cent adding up."""

from decimal import Decimal
from typing import Any
from uuid import UUID

import httpx2
import pytest
from pydantic import ValidationError

from claimforge_api.estimates import totals
from claimforge_api.estimates.schemas import EstimateCreate, EstimateRead

D = Decimal
ADDRESS = {"line1": "123 Main St", "city": "Austin", "region": "TX", "postal_code": "78701"}


def test_the_arithmetic() -> None:
    found = totals.totals(
        [totals.Line(D("1000.00"), True), totals.Line(D("500.00"), False)],
        tax_percent=D("8.25"),
        overhead_percent=D("10"),
        profit_percent=D("10"),
    )

    # Tax on the taxable 1000.00; overhead and profit on 1500.00 + 82.50.
    assert found == totals.Totals(
        subtotal=D("1500.00"),
        taxable_subtotal=D("1000.00"),
        tax=D("82.50"),
        overhead=D("158.25"),
        profit=D("158.25"),
        total=D("1899.00"),
    )


def test_each_amount_is_rounded_and_the_total_adds_them() -> None:
    found = totals.totals(
        [totals.Line(D("33.33"), True)],
        tax_percent=D("8.25"),  # 2.749725
        overhead_percent=D("10"),  # 3.60795
        profit_percent=D("10"),
    )

    assert (found.tax, found.overhead, found.profit) == (D("2.75"), D("3.61"), D("3.61"))
    assert found.total == found.subtotal + found.tax + found.overhead + found.profit


def test_no_rates_no_extras() -> None:
    found = totals.totals(
        [totals.Line(D("12.34"), True)],
        tax_percent=D(0),
        overhead_percent=D(0),
        profit_percent=D(0),
    )
    assert found.total == D("12.34")
    assert totals.totals(
        [], tax_percent=D(5), overhead_percent=D(5), profit_percent=D(5)
    ).total == D("0.00")


def test_percentages() -> None:
    created = EstimateCreate.model_validate(
        {"title": "X", "tax_percent": "8.25", "profit_percent": 10}
    )
    assert (created.tax_percent, created.profit_percent) == (D("8.25"), D(10))
    for bad in ("-1", "100.001", "8.2555"):
        with pytest.raises(ValidationError):
            EstimateCreate.model_validate({"title": "X", "tax_percent": bad})
    schema = EstimateRead.model_json_schema()["properties"]["tax_percent"]
    assert schema["type"] == "string"


async def send(
    client: httpx2.AsyncClient, method: str, url: str, expect: int = 0, **body: Any
) -> Any:
    response = await client.request(method, url, json=body if body else None)
    if expect:
        assert response.status_code == expect, response.text
    else:
        assert response.status_code < 300, response.text
    return response.json() if response.content else None


async def test_totals_over_http(auth_client: httpx2.AsyncClient, organization_id: UUID) -> None:
    base = f"/v1/organizations/{organization_id}"
    claim = await send(
        auth_client, "POST", f"{base}/claims", loss_type="water", property={"address": ADDRESS}
    )
    url = f"{base}/claims/{claim['id']}/estimates"
    estimate = await send(
        auth_client,
        "POST",
        url,
        title="Repairs",
        tax_percent="8.25",
        overhead_percent="10",
        profit_percent="10",
    )
    lines = f"{url}/{estimate['id']}/lines"
    await send(
        auth_client, "POST", lines, description="Drywall", unit="SF", unit_price="2", quantity="500"
    )
    estimate = await send(
        auth_client,
        "POST",
        lines,
        description="Labor",
        unit="HR",
        unit_price="100",
        quantity="5",
        taxable=False,
    )

    assert estimate["totals"] == {
        "subtotal": "1500.00",
        "taxable_subtotal": "1000.00",
        "tax": "82.50",
        "overhead": "158.25",
        "profit": "158.25",
        "total": "1899.00",
    }
    assert (estimate["tax_percent"], estimate["overhead_percent"]) == ("8.25", "10")
    assert [e["total"] for e in await send(auth_client, "GET", url)] == ["1899.00"]

    no_tax = await send(auth_client, "PATCH", f"{url}/{estimate['id']}", tax_percent="0")
    assert no_tax["totals"]["total"] == "1800.00"
    await send(auth_client, "POST", f"{url}/{estimate['id']}/status", status="submitted")
    locked = await send(auth_client, "PATCH", f"{url}/{estimate['id']}", 409, profit_percent="20")
    assert locked["code"] == "estimate_not_draft"
