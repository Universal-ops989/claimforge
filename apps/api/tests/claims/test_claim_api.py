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


async def test_list_claims(auth_client: httpx2.AsyncClient, base: str) -> None:
    dana = await post(auth_client, f"{base}/contacts", {"full_name": "Dana Whitfield"})
    first = await new_claim(
        auth_client,
        base,
        loss_date="2026-10-01",
        contacts=[{"contact_id": dana["id"], "role": "insured", "is_primary": True}],
    )
    second = await new_claim(auth_client, base, loss_type="fire")

    listed = await auth_client.get(f"{base}/claims", params={"limit": 1})
    assert listed.status_code == 200
    page = listed.json()
    assert [c["id"] for c in page["items"]] == [second["id"]]
    assert page["has_more"] is True
    row = page["items"][0]
    assert row["property"]["address"]["formatted"] == "123 N Main St, Austin, TX 78701"
    assert row["primary_contact"] is None
    assert "contacts" not in row  # Rows are summaries.

    rest = await auth_client.get(
        f"{base}/claims", params={"limit": 1, "cursor": page["next_cursor"]}
    )
    (row,) = rest.json()["items"]
    assert row["id"] == first["id"]
    assert row["primary_contact"]["contact"]["full_name"] == "Dana Whitfield"
    assert row["primary_contact"]["role"] == "insured"


async def test_list_filters_and_sorts_over_http(auth_client: httpx2.AsyncClient, base: str) -> None:
    water = await new_claim(auth_client, base, loss_date="2026-10-01")
    fire = await new_claim(auth_client, base, loss_type="fire")
    await new_claim(auth_client, base, loss_type="mold", loss_date="2026-09-01")

    async def ids(params: dict[str, str | list[str]]) -> list[str]:
        response = await auth_client.get(f"{base}/claims", params=params)
        assert response.status_code == 200, response.text
        return [c["id"] for c in response.json()["items"]]

    both = await ids({"loss_type": ["water", "fire"], "sort": "created_at"})
    assert both == [water["id"], fire["id"]]
    assert await ids({"q": water["number"]}) == [water["id"]]
    assert await ids({"loss_date_from": "2026-09-15"}) == [water["id"]]
    assert (await ids({"sort": "-loss_date"}))[0] == fire["id"]  # no loss date: first


@pytest.mark.parametrize(
    ("params", "status", "code"),
    [
        ({"loss_date_from": "2026-05-02", "loss_date_to": "2026-05-01"}, 422, "validation_failed"),
        ({"sort": "-number"}, 422, "validation_failed"),
        ({"status": "lost"}, 422, "validation_failed"),
        ({"q": "x" * 201}, 422, "validation_failed"),
    ],
)
async def test_list_rejects_bad_parameters(
    auth_client: httpx2.AsyncClient, base: str, params: dict[str, str], status: int, code: str
) -> None:
    response = await auth_client.get(f"{base}/claims", params=params)

    assert response.status_code == status
    assert response.json()["code"] == code


async def test_a_cursor_only_continues_its_own_sort(
    auth_client: httpx2.AsyncClient, base: str
) -> None:
    await new_claim(auth_client, base)
    await new_claim(auth_client, base)
    page = (await auth_client.get(f"{base}/claims", params={"limit": 1})).json()

    response = await auth_client.get(
        f"{base}/claims", params={"limit": 1, "cursor": page["next_cursor"], "sort": "loss_date"}
    )

    assert response.status_code == 400
    assert response.json()["code"] == "invalid_cursor"


async def test_who_can_list_claims(
    auth_client: httpx2.AsyncClient, client_for: ClientFor, base: str
) -> None:
    await new_claim(auth_client, base)
    viewer = await client_for(Role.VIEWER)
    outsider = await client_for(None)

    listed = await viewer.get(f"{base}/claims")
    assert listed.status_code == 200
    assert len(listed.json()["items"]) == 1
    assert (await outsider.get(f"{base}/claims")).status_code == 404


async def test_edit_a_claim(
    auth_client: httpx2.AsyncClient, client_for: ClientFor, base: str
) -> None:
    claim = await new_claim(auth_client, base, description="Burst pipe")
    url = f"{base}/claims/{claim['id']}"

    response = await auth_client.patch(
        url, json={"carrier_claim_number": "LSM-88213", "description": None}
    )
    assert response.status_code == 200, response.text
    edited = response.json()
    assert edited["carrier_claim_number"] == "LSM-88213"
    assert edited["description"] is None
    assert edited["number"] == claim["number"]
    assert (await auth_client.get(url)).json() == edited

    events = await auth_client.get(
        f"{base}/audit-events", params={"entity_type": "claim", "entity_id": claim["id"]}
    )
    updated = events.json()["items"][0]
    assert updated["action"] == "claim.updated"
    assert updated["actor"]["full_name"] == "Morgan Member"
    assert updated["changes"]["carrier_claim_number"] == [None, "LSM-88213"]

    future = await auth_client.patch(url, json={"loss_date": "2999-01-01"})
    assert (future.status_code, future.json()["code"]) == (422, "loss_date_in_future")
    status = await auth_client.patch(url, json={"status": "closed"})
    assert (status.status_code, status.json()["code"]) == (422, "validation_failed")

    viewer = await client_for(Role.VIEWER)
    outsider = await client_for(None)
    assert (await viewer.patch(url, json={"loss_type": "fire"})).status_code == 403
    assert (await outsider.patch(url, json={"loss_type": "fire"})).status_code == 404


async def test_status_workflow_over_http(
    auth_client: httpx2.AsyncClient, client_for: ClientFor, base: str
) -> None:
    claim = await new_claim(auth_client, base)
    url = f"{base}/claims/{claim['id']}"
    adjuster = await client_for(Role.ADJUSTER)
    assert claim["next_statuses"] == ["inspected", "in_progress", "on_hold", "cancelled"]

    async def move(client: httpx2.AsyncClient, **body: Any) -> httpx2.Response:
        return await client.post(f"{url}/status", json=body)

    moved = await move(adjuster, status="in_progress", expected_status="new")
    assert moved.status_code == 200, moved.text
    assert (moved.json()["status"], moved.json()["next_statuses"]) == (
        "in_progress",
        ["on_hold", "completed", "cancelled"],
    )

    stale = await move(adjuster, status="on_hold", reason="Parts", expected_status="new")
    assert (stale.status_code, stale.json()["current_status"]) == (409, "in_progress")
    skipped = await move(adjuster, status="closed")
    assert (skipped.status_code, skipped.json()["code"]) == (422, "invalid_status_transition")
    assert skipped.json()["allowed"] == ["on_hold", "completed", "cancelled"]
    unexplained = await move(adjuster, status="on_hold")
    assert (unexplained.status_code, unexplained.json()["code"]) == (422, "reason_required")

    assert (await move(adjuster, status="completed")).status_code == 200
    assert (await move(adjuster, status="closed")).status_code == 200

    # Closed: read-only, and only a supervisor can reopen it.
    edit = await adjuster.patch(url, json={"description": "late note"})
    assert (edit.status_code, edit.json()["code"]) == (409, "claim_locked")
    assert edit.json()["claim_status"] == "closed"
    denied = await move(adjuster, status="in_progress", reason="Supplement")
    assert (denied.status_code, denied.json()["required_permission"]) == (403, "claims:reopen")
    assert (await move(auth_client, status="in_progress", reason="Supplement")).status_code == 200

    history = (await adjuster.get(f"{url}/status-history")).json()
    assert [(h["from_status"], h["to_status"]) for h in history] == [
        ("new", "in_progress"),
        ("in_progress", "completed"),
        ("completed", "closed"),
        ("closed", "in_progress"),
    ]
    assert history[-1]["reason"] == "Supplement"
    assert history[-1]["changed_by"]["full_name"] == "Morgan Member"
    assert history[0]["changed_by"]["id"] != history[-1]["changed_by"]["id"]


async def test_status_endpoints_respect_roles_and_tenants(
    auth_client: httpx2.AsyncClient, client_for: ClientFor, base: str
) -> None:
    claim = await new_claim(auth_client, base)
    url = f"{base}/claims/{claim['id']}"
    viewer = await client_for(Role.VIEWER)
    outsider = await client_for(None)

    assert (await viewer.get(f"{url}/status-history")).json() == []
    assert (await viewer.post(f"{url}/status", json={"status": "inspected"})).status_code == 403
    assert (await outsider.get(f"{url}/status-history")).status_code == 404
    assert (await outsider.post(f"{url}/status", json={"status": "inspected"})).status_code == 404
    bad = await auth_client.post(f"{url}/status", json={"status": "archived"})
    assert (bad.status_code, bad.json()["code"]) == (422, "validation_failed")


async def test_assignments_over_http(
    auth_client: httpx2.AsyncClient, client_for: ClientFor, base: str
) -> None:
    claim = await new_claim(auth_client, base)
    url = f"{base}/claims/{claim['id']}"
    adjuster = await client_for(Role.ADJUSTER)
    technician = await client_for(Role.TECHNICIAN)
    adjuster_id = (await adjuster.get("/v1/me")).json()["id"]
    technician_id = (await technician.get("/v1/me")).json()["id"]
    me = (await auth_client.get("/v1/me")).json()["id"]
    assert claim["assignments"] == []

    assigned = await auth_client.post(
        f"{url}/assignments", json={"user_id": adjuster_id, "role": "adjuster"}
    )
    assert assigned.status_code == 201, assigned.text
    assert assigned.json()["user"] == {"id": adjuster_id, "full_name": "Someone"}
    assert assigned.json()["assigned_by_id"] == me
    await post(adjuster, f"{url}/assignments", {"user_id": technician_id, "role": "contractor"})

    twice = await auth_client.post(
        f"{url}/assignments", json={"user_id": technician_id, "role": "field_technician"}
    )
    assert (twice.status_code, twice.json()["code"]) == (409, "already_assigned")
    unable = await auth_client.post(
        f"{url}/assignments", json={"user_id": technician_id, "role": "adjuster"}
    )
    assert (unable.status_code, unable.json()["assignee_needs"]) == (422, "claims:write")
    stranger = await auth_client.post(
        f"{url}/assignments",
        json={"user_id": "01a1d4e6-5c4e-73d8-9dbc-100ca276475e", "role": "contractor"},
    )
    assert (stranger.status_code, stranger.json()["code"]) == (422, "unknown_assignee")

    shown = (await auth_client.get(url)).json()["assignments"]
    assert [(a["user"]["id"], a["role"]) for a in shown] == [
        (adjuster_id, "adjuster"),
        (technician_id, "contractor"),
    ]

    mine = (await adjuster.get(f"{base}/claims", params={"assigned_to": adjuster_id})).json()
    assert [(c["id"], c["adjuster"]["id"]) for c in mine["items"]] == [(claim["id"], adjuster_id)]
    unowned = await auth_client.get(f"{base}/claims", params={"has_adjuster": "false"})
    assert unowned.json()["items"] == []

    assert (await technician.delete(f"{url}/assignments/{adjuster_id}")).status_code == 403
    assert (await auth_client.delete(f"{url}/assignments/{adjuster_id}")).status_code == 204
    assert (await auth_client.delete(f"{url}/assignments/{adjuster_id}")).status_code == 404
    listed = (await auth_client.get(f"{base}/claims")).json()["items"]
    assert listed[0]["adjuster"] is None
