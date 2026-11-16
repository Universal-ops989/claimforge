"""Estimates over HTTP: lines from a price list, approval, the timeline, and refusals."""

from typing import Any
from uuid import UUID

import httpx2
import pytest
from tests.conftest import ClientFor

from claimforge_api.users.models import Role

ADDRESS = {"line1": "123 Main St", "city": "Austin", "region": "TX", "postal_code": "78701"}


async def send(
    client: httpx2.AsyncClient, method: str, url: str, expect: int = 0, **body: Any
) -> Any:
    response = await client.request(method, url, json=body if body else None)
    if expect:
        assert response.status_code == expect, response.text
    else:
        assert response.status_code < 300, response.text
    return response.json() if response.content else None


class Office:
    def __init__(self, client: httpx2.AsyncClient, base: str) -> None:
        self.client, self.base = client, base

    async def open(self) -> "Office":
        lists = f"{self.base}/price-lists"
        price_list = await send(self.client, "POST", lists, name="TX Austin", is_default=True)
        self.dehu = await send(
            self.client,
            "POST",
            f"{lists}/{price_list['id']}/items",
            code="WTR DHM",
            description="Dehumidifier - Large",
            unit="DA",
            unit_price="123.40",
        )
        claim = await send(
            self.client,
            "POST",
            f"{self.base}/claims",
            loss_type="water",
            property={"address": ADDRESS},
        )
        self.url = f"{self.base}/claims/{claim['id']}/estimates"
        return self


@pytest.fixture
async def office(auth_client: httpx2.AsyncClient, organization_id: UUID) -> Office:
    return await Office(auth_client, f"/v1/organizations/{organization_id}").open()


async def test_an_estimate_from_start_to_approval(office: Office) -> None:
    client, url = office.client, office.url
    estimate = await send(client, "POST", url, 201, title="Mitigation")
    assert (estimate["number"], estimate["status"], estimate["price_list"]["name"]) == (
        1,
        "draft",
        "TX Austin",
    )
    lines = f"{url}/{estimate['id']}/lines"

    estimate = await send(client, "POST", lines, 201, price_item_id=office.dehu["id"], quantity="3")
    estimate = await send(
        client,
        "POST",
        lines,
        201,
        description="Antimicrobial application",
        unit="sf",
        unit_price="0.42",
        quantity=250.5,
        position=1,
    )
    assert [
        (ln["position"], ln["unit"], ln["quantity"], ln["total"]) for ln in estimate["lines"]
    ] == [
        (1, "SF", "250.50", "105.21"),
        (2, "DA", "3.00", "370.20"),
    ]
    first = estimate["lines"][0]
    estimate = await send(client, "PATCH", f"{lines}/{first['id']}", position=2, quantity="300")
    assert [ln["code"] for ln in estimate["lines"]] == ["WTR DHM", None]
    assert estimate["lines"][1]["total"] == "126.00"

    for status in ("submitted", "approved"):
        estimate = await send(client, "POST", f"{url}/{estimate['id']}/status", status=status)
    assert (estimate["status"], estimate["next_statuses"]) == ("approved", ["draft"])

    listed = await send(client, "GET", url)
    assert [(e["number"], e["status"]) for e in listed] == [(1, "approved")]
    claim_url = url.removesuffix("/estimates")
    timeline = await send(client, "GET", f"{claim_url}/timeline?kind=estimates")
    assert [entry["summary"] for entry in timeline["items"]] == [
        "Approved estimate 1",
        "Submitted estimate 1",
        "Started estimate 1: Mitigation",
    ]


async def test_refusals(office: Office, client_for: ClientFor) -> None:
    client, url = office.client, office.url
    estimate = await send(client, "POST", url, 201, title="Repairs")
    lines = f"{url}/{estimate['id']}/lines"
    status = f"{url}/{estimate['id']}/status"

    empty = await send(client, "POST", status, 422, status="submitted")
    assert empty["code"] == "estimate_transition"
    estimate = await send(client, "POST", lines, 201, price_item_id=office.dehu["id"], quantity="1")
    skipped = await send(client, "POST", status, 422, status="approved")
    assert skipped["allowed"] == ["submitted"]
    await send(client, "POST", status, status="submitted")
    locked = await send(client, "POST", lines, 409, price_item_id=office.dehu["id"], quantity="1")
    assert locked["code"] == "estimate_not_draft"
    assert (await send(client, "DELETE", f"{url}/{estimate['id']}", 409))["code"] == (
        "estimate_not_draft"
    )

    technician = await client_for(Role.TECHNICIAN)
    assert (await technician.post(url, json={"title": "Mine"})).status_code == 403
    assert (await technician.get(f"{url}/{estimate['id']}")).status_code == 200
    bad = await client.post(lines, json={"description": "No price", "unit": "EA", "quantity": "1"})
    assert bad.status_code == 422


async def test_withdrawing_and_deleting_a_draft(office: Office) -> None:
    client, url = office.client, office.url
    estimate = await send(client, "POST", url, 201, title="Contents")
    estimate = await send(
        client,
        "POST",
        f"{url}/{estimate['id']}/lines",
        201,
        price_item_id=office.dehu["id"],
        quantity="1",
    )
    await send(client, "POST", f"{url}/{estimate['id']}/status", status="submitted")
    withdrawn = await send(client, "POST", f"{url}/{estimate['id']}/status", status="draft")
    assert withdrawn["status"] == "draft"
    line = withdrawn["lines"][0]
    after = await send(client, "DELETE", f"{url}/{estimate['id']}/lines/{line['id']}")
    assert after["lines"] == []
    await send(client, "DELETE", f"{url}/{estimate['id']}", 204)
    assert (await client.get(f"{url}/{estimate['id']}")).status_code == 404

    claim_url = url.removesuffix("/estimates")
    timeline = await send(client, "GET", f"{claim_url}/timeline?kind=estimates")
    assert [entry["summary"] for entry in timeline["items"]][:2] == [
        "Deleted draft estimate 1",
        "Withdrew estimate 1",
    ]
