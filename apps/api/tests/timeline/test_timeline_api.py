"""The claim timeline over HTTP: a claim's life story, filters, paging and access."""

from typing import Any
from uuid import UUID

import httpx2
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from tests.conftest import ClientFor

from claimforge_api.claims.models import Claim
from claimforge_api.users.models import Role

ADDRESS = {"line1": "123 Main St", "city": "Austin", "region": "TX", "postal_code": "78701"}


async def send(client: httpx2.AsyncClient, method: str, url: str, **body: Any) -> dict[str, Any]:
    response = await client.request(method, url, json=body or None)
    assert response.status_code < 300, response.text
    payload: dict[str, Any] = response.json() if response.content else {}
    return payload


@pytest.fixture
def base(organization_id: UUID) -> str:
    return f"/v1/organizations/{organization_id}"


@pytest.fixture
async def claim(auth_client: httpx2.AsyncClient, base: str) -> dict[str, Any]:
    return await send(
        auth_client, "POST", f"{base}/claims", loss_type="water", property={"address": ADDRESS}
    )


async def story(client: httpx2.AsyncClient, url: str, **params: Any) -> list[str]:
    response = await client.get(f"{url}/timeline", params=params)
    assert response.status_code == 200, response.text
    return [entry["summary"] for entry in response.json()["items"]]


async def test_a_claims_life_in_order(
    auth_client: httpx2.AsyncClient, client_for: ClientFor, base: str, claim: dict[str, Any]
) -> None:
    url = f"{base}/claims/{claim['id']}"
    adjuster = await client_for(Role.ADJUSTER)
    adjuster_id = (await adjuster.get("/v1/me")).json()["id"]
    dana = await send(auth_client, "POST", f"{base}/contacts", full_name="Dana Whitfield")

    await send(auth_client, "POST", f"{url}/contacts", contact_id=dana["id"], role="insured")
    await send(auth_client, "POST", f"{url}/assignments", user_id=adjuster_id, role="adjuster")
    await send(auth_client, "PATCH", url, description="Supply line burst under the sink")
    house = await send(auth_client, "POST", f"{url}/structures", name="Main house")
    den = await send(auth_client, "POST", f"{url}/structures/{house['id']}/rooms", name="Den")
    await send(auth_client, "PATCH", f"{url}/rooms/{den['id']}", name="Kitchen")
    await send(
        auth_client,
        "POST",
        f"{url}/rooms/{den['id']}/damage-items",
        surface="wall",
        material="Drywall",
    )
    await send(auth_client, "POST", f"{url}/notes", body=f"<@{adjuster_id}> please call Dana")
    task = await send(auth_client, "POST", f"{url}/tasks", title="Set dehus")
    await send(adjuster, "PATCH", f"{url}/tasks/{task['id']}", done=True)
    await send(auth_client, "POST", f"{url}/status", status="on_hold", reason="Waiting on PA")

    assert await story(auth_client, url) == [
        "Changed the status from new to on hold: Waiting on PA",
        "Completed task “Set dehus”",
        "Added task “Set dehus”",
        "Wrote a note: @Someone please call Dana",
        "Recorded Drywall damage (water)",
        "Renamed room Den to Kitchen",
        "Added room Den",
        "Added structure Main house",
        "Edited the claim: description",
        "Assigned Someone as adjuster",
        "Added Dana Whitfield as insured",
        f"Opened claim {claim['number']}",
    ]

    [done] = (
        await auth_client.get(f"{url}/timeline", params={"kind": "tasks", "limit": 1})
    ).json()["items"]
    assert (done["kind"], done["action"], done["actor"]["id"]) == (
        "tasks",
        "task.updated",
        adjuster_id,
    )
    assert done["subject"] == {"type": "task", "id": task["id"]}
    assert "claim_id" not in done["changes"]


async def test_filter_by_kind_and_page(
    auth_client: httpx2.AsyncClient, base: str, claim: dict[str, Any]
) -> None:
    url = f"{base}/claims/{claim['id']}"
    for body in ["one", "two", "three"]:
        await send(auth_client, "POST", f"{url}/notes", body=body)
    await send(auth_client, "POST", f"{url}/tasks", title="Call carrier")

    assert await story(auth_client, url, kind=["notes", "tasks"]) == [
        "Added task “Call carrier”",
        "Wrote a note: three",
        "Wrote a note: two",
        "Wrote a note: one",
    ]
    first = (await auth_client.get(f"{url}/timeline", params={"kind": "notes", "limit": 2})).json()
    rest = (
        await auth_client.get(
            f"{url}/timeline", params={"kind": "notes", "limit": 2, "cursor": first["next_cursor"]}
        )
    ).json()
    assert [e["summary"] for e in rest["items"]] == ["Wrote a note: one"]
    assert (await auth_client.get(f"{url}/timeline", params={"kind": "gossip"})).status_code == 422


async def test_deleting_a_structure_shows_every_removal(
    auth_client: httpx2.AsyncClient, base: str, claim: dict[str, Any]
) -> None:
    url = f"{base}/claims/{claim['id']}"
    garage = await send(auth_client, "POST", f"{url}/structures", name="Garage")
    await send(auth_client, "POST", f"{url}/structures/{garage['id']}/rooms", name="Shop")
    await send(auth_client, "DELETE", f"{url}/structures/{garage['id']}")

    removals = (await story(auth_client, url, kind="layout"))[:2]
    assert sorted(removals) == ["Deleted room Shop", "Deleted structure Garage"]


async def test_who_can_read_it(
    auth_client: httpx2.AsyncClient, client_for: ClientFor, base: str, claim: dict[str, Any]
) -> None:
    url = f"{base}/claims/{claim['id']}"
    viewer = await client_for(Role.VIEWER)
    outsider = await client_for(None)

    # Viewers can't read the raw audit log, but they can read a claim's story.
    assert (await viewer.get(f"{base}/audit-events")).status_code == 403
    assert await story(viewer, url) == [f"Opened claim {claim['number']}"]
    assert (await outsider.get(f"{url}/timeline")).status_code == 404


async def test_deleted_claims_have_no_timeline(
    auth_client: httpx2.AsyncClient, db_session: AsyncSession, base: str, claim: dict[str, Any]
) -> None:
    # Claims are soft-deleted; there is no HTTP endpoint for it yet.
    row = await db_session.get(Claim, UUID(claim["id"]))
    assert row is not None
    row.soft_delete()
    await db_session.commit()

    response = await auth_client.get(f"{base}/claims/{claim['id']}/timeline")
    assert response.status_code == 404
