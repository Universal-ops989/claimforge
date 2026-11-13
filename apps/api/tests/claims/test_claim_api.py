"""Claims over HTTP: creation, reading, contact links, roles and tenant isolation."""

from typing import Any
from uuid import UUID

import httpx2
import pytest
from tests.conftest import ClientFor

from claimforge_api.users.models import Role

ADDRESS = {
    "line1": "123 north main street",
    "city": "Austin",
    "region": "TX",
    "postal_code": "78701",
}


@pytest.fixture
def base(organization_id: UUID) -> str:
    return f"/v1/organizations/{organization_id}"


async def post(client: httpx2.AsyncClient, url: str, body: dict[str, Any]) -> dict[str, Any]:
    response = await client.post(url, json=body)
    assert response.status_code == 201, response.text
    payload: dict[str, Any] = response.json()
    return payload


async def new_claim(client: httpx2.AsyncClient, base: str, **fields: Any) -> dict[str, Any]:
    body = {"loss_type": "water", "property": {"address": ADDRESS}} | fields
    return await post(client, f"{base}/claims", body)


async def test_create_and_read(auth_client: httpx2.AsyncClient, base: str) -> None:
    dana = await post(auth_client, f"{base}/contacts", {"full_name": "Dana Whitfield"})

    claim = await new_claim(
        auth_client,
        base,
        loss_date="2026-11-10",
        carrier_claim_number="LSM-88213",
        contacts=[{"contact_id": dana["id"], "role": "insured", "is_primary": True}],
    )

    assert claim["number"].endswith("-00001")
    assert claim["status"] == "new"
    assert claim["carrier_claim_number"] == "LSM-88213"
    assert claim["property"]["address"]["formatted"] == "123 N Main St, Austin, TX 78701"
    assert [(c["contact"]["full_name"], c["role"], c["is_primary"]) for c in claim["contacts"]] == [
        ("Dana Whitfield", "insured", True)
    ]
    assert (await auth_client.get(f"{base}/claims/{claim['id']}")).json() == claim
    assert (await auth_client.get(f"{base}/claims/by-number/{claim['number']}")).json() == claim


async def test_a_second_claim_at_the_same_address_shares_the_property(
    auth_client: httpx2.AsyncClient, base: str
) -> None:
    first = await new_claim(auth_client, base)
    second = await new_claim(
        auth_client,
        base,
        loss_type="wind",
        property={"address": ADDRESS | {"line1": "123 N Main St"}},
    )

    assert second["property"]["id"] == first["property"]["id"]
    assert second["number"] != first["number"]


@pytest.mark.parametrize(
    ("body", "status", "code"),
    [
        ({"property_id": "01a1d4e6-5c4e-73d8-9dbc-100ca276475e"}, 422, "unknown_property"),
        (
            {
                "property": {"address": ADDRESS},
                "contacts": [
                    {"contact_id": "01a1d4e6-5c4e-73d8-9dbc-100ca276475e", "role": "tenant"}
                ],
            },
            422,
            "unknown_contact",
        ),
        ({"property": {"address": ADDRESS}, "loss_date": "2999-01-01"}, 422, "loss_date_in_future"),
        ({"property": {"address": ADDRESS | {"postal_code": "1"}}}, 422, "validation_failed"),
    ],
)
async def test_create_rejects_bad_references_and_input(
    auth_client: httpx2.AsyncClient, base: str, body: dict[str, Any], status: int, code: str
) -> None:
    response = await auth_client.post(f"{base}/claims", json={"loss_type": "water"} | body)

    assert response.status_code == status
    assert response.json()["code"] == code


async def test_manage_contacts_on_a_claim(auth_client: httpx2.AsyncClient, base: str) -> None:
    claim = await new_claim(auth_client, base)
    dana = await post(auth_client, f"{base}/contacts", {"full_name": "Dana"})
    riley = await post(auth_client, f"{base}/contacts", {"full_name": "Riley"})
    links = f"{base}/claims/{claim['id']}/contacts"

    linked = await post(
        auth_client, links, {"contact_id": dana["id"], "role": "insured", "is_primary": True}
    )
    assert linked["contact"]["id"] == dana["id"]
    await post(auth_client, links, {"contact_id": riley["id"], "role": "tenant"})

    again = await auth_client.post(links, json={"contact_id": dana["id"], "role": "tenant"})
    assert again.status_code == 409
    assert again.json()["code"] == "contact_already_linked"

    promoted = await auth_client.patch(f"{links}/{riley['id']}", json={"is_primary": True})
    assert promoted.status_code == 200
    assert promoted.json()["is_primary"] is True

    assert (await auth_client.delete(f"{links}/{dana['id']}")).status_code == 204
    assert (await auth_client.delete(f"{links}/{dana['id']}")).status_code == 404

    current = (await auth_client.get(f"{base}/claims/{claim['id']}")).json()["contacts"]
    assert [(c["contact"]["full_name"], c["role"], c["is_primary"]) for c in current] == [
        ("Riley", "tenant", True)
    ]


async def test_roles(auth_client: httpx2.AsyncClient, client_for: ClientFor, base: str) -> None:
    claim = await new_claim(auth_client, base)
    dana = await post(auth_client, f"{base}/contacts", {"full_name": "Dana"})
    viewer = await client_for(Role.VIEWER)
    adjuster = await client_for(Role.ADJUSTER)

    assert (await viewer.get(f"{base}/claims/{claim['id']}")).status_code == 200
    denied = await viewer.post(
        f"{base}/claims", json={"loss_type": "fire", "property_id": claim["property"]["id"]}
    )
    assert denied.status_code == 403
    assert denied.json()["required_permission"] == "claims:write"
    link = {"contact_id": dana["id"], "role": "insured"}
    assert (
        await viewer.post(f"{base}/claims/{claim['id']}/contacts", json=link)
    ).status_code == 403

    await new_claim(adjuster, base, property_id=claim["property"]["id"], property=None)
    assert (
        await adjuster.post(f"{base}/claims/{claim['id']}/contacts", json=link)
    ).status_code == 201


async def test_other_organizations_see_nothing(
    auth_client: httpx2.AsyncClient, client_for: ClientFor, base: str
) -> None:
    claim = await new_claim(auth_client, base)
    outsider = await client_for(None)

    assert (await outsider.get(f"{base}/claims/{claim['id']}")).status_code == 404
    assert (await outsider.get(f"{base}/claims/by-number/{claim['number']}")).status_code == 404

    # Their own organization cannot reach our claim by id either.
    theirs = (await outsider.post("/v1/organizations", json={"name": "Theirs"})).json()
    response = await outsider.get(f"/v1/organizations/{theirs['id']}/claims/{claim['id']}")
    assert response.status_code == 404


async def test_anonymous_users_are_turned_away(client: httpx2.AsyncClient, base: str) -> None:
    assert (await client.post(f"{base}/claims", json={})).status_code == 401


async def test_claim_activity_shows_up_in_the_audit_timeline(
    auth_client: httpx2.AsyncClient, base: str
) -> None:
    claim = await new_claim(auth_client, base)
    dana = await post(auth_client, f"{base}/contacts", {"full_name": "Dana"})
    await post(
        auth_client,
        f"{base}/claims/{claim['id']}/contacts",
        {"contact_id": dana["id"], "role": "insured"},
    )

    created = await auth_client.get(
        f"{base}/audit-events", params={"entity_type": "claim", "entity_id": claim["id"]}
    )
    links = await auth_client.get(f"{base}/audit-events", params={"entity_type": "claim_contact"})

    assert [e["action"] for e in created.json()["items"]] == ["claim.created"]
    assert created.json()["items"][0]["actor"]["full_name"] == "Morgan Member"
    assert [e["changes"]["contact_id"][1] for e in links.json()["items"]] == [dana["id"]]
