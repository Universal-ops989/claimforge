"""Claim notes over HTTP: mentions, editing rules, roles, tenants and locked claims."""

from typing import Any
from uuid import UUID, uuid4

import httpx2
import pytest
from tests.conftest import ClientFor

from claimforge_api.users.models import Role

ADDRESS = {"line1": "123 Main St", "city": "Austin", "region": "TX", "postal_code": "78701"}


async def post(client: httpx2.AsyncClient, url: str, body: dict[str, Any]) -> dict[str, Any]:
    response = await client.post(url, json=body)
    assert response.status_code == 201, response.text
    payload: dict[str, Any] = response.json()
    return payload


async def me(client: httpx2.AsyncClient) -> str:
    user_id: str = (await client.get("/v1/me")).json()["id"]
    return user_id


@pytest.fixture
def base(organization_id: UUID) -> str:
    return f"/v1/organizations/{organization_id}"


@pytest.fixture
async def claim(auth_client: httpx2.AsyncClient, base: str) -> dict[str, Any]:
    return await post(
        auth_client, f"{base}/claims", {"loss_type": "water", "property": {"address": ADDRESS}}
    )


async def test_write_mention_edit_and_delete(
    auth_client: httpx2.AsyncClient, client_for: ClientFor, base: str, claim: dict[str, Any]
) -> None:
    technician = await client_for(Role.TECHNICIAN)
    tech_id = await me(technician)
    notes = f"{base}/claims/{claim['id']}/notes"

    note = await post(auth_client, notes, {"body": f"<@{tech_id}> please map the hallway"})
    assert note["text"] == "@Someone please map the hallway"
    assert [m["id"] for m in note["mentions"]] == [tech_id]
    assert (note["author"]["full_name"], note["claim"]) == (
        "Morgan Member",
        {"id": claim["id"], "number": claim["number"]},
    )
    assert note["edited_at"] is None

    inbox = (await technician.get(f"{base}/notes/mentioning-me")).json()
    assert [n["id"] for n in inbox["items"]] == [note["id"]]

    url = f"{notes}/{note['id']}"
    edited = await auth_client.patch(url, json={"body": "Hallway done, thanks"})
    assert edited.status_code == 200, edited.text
    assert (edited.json()["mentions"], edited.json()["edited_at"] is not None) == ([], True)
    assert (await technician.get(f"{base}/notes/mentioning-me")).json()["items"] == []

    assert (await auth_client.delete(url)).status_code == 204
    assert (await auth_client.get(notes)).json()["items"] == []


async def test_pages(auth_client: httpx2.AsyncClient, base: str, claim: dict[str, Any]) -> None:
    notes = f"{base}/claims/{claim['id']}/notes"
    for body in ["one", "two", "three"]:
        await post(auth_client, notes, {"body": body})

    first = (await auth_client.get(notes, params={"limit": 2})).json()
    rest = (
        await auth_client.get(notes, params={"limit": 2, "cursor": first["next_cursor"]})
    ).json()

    assert [n["body"] for n in first["items"]] == ["three", "two"]
    assert ([n["body"] for n in rest["items"]], rest["has_more"]) == (["one"], False)


async def test_problems(
    auth_client: httpx2.AsyncClient, client_for: ClientFor, base: str, claim: dict[str, Any]
) -> None:
    notes = f"{base}/claims/{claim['id']}/notes"
    stranger = uuid4()

    unknown = await auth_client.post(notes, json={"body": f"<@{stranger}> hi"})
    assert (unknown.status_code, unknown.json()["code"], unknown.json()["user_ids"]) == (
        422,
        "unknown_mention",
        [str(stranger)],
    )
    for body in [{"body": ""}, {"body": "x", "pinned": True}, {}]:
        assert (await auth_client.post(notes, json=body)).status_code == 422, body

    note = await post(auth_client, notes, {"body": "Mine"})
    adjuster = await client_for(Role.ADJUSTER)
    not_mine = await adjuster.patch(f"{notes}/{note['id']}", json={"body": "Ours"})
    assert (not_mine.status_code, not_mine.json()["code"]) == (403, "not_note_author")
    assert (await adjuster.delete(f"{notes}/{note['id']}")).status_code == 403
    assert (await auth_client.patch(f"{notes}/{uuid4()}", json={"body": "x"})).status_code == 404


async def test_roles_and_tenants(
    auth_client: httpx2.AsyncClient, client_for: ClientFor, base: str, claim: dict[str, Any]
) -> None:
    notes = f"{base}/claims/{claim['id']}/notes"
    await post(auth_client, notes, {"body": "Visible to members"})
    viewer = await client_for(Role.VIEWER)
    outsider = await client_for(None)

    assert len((await viewer.get(notes)).json()["items"]) == 1
    denied = await viewer.post(notes, json={"body": "Me too"})
    assert (denied.status_code, denied.json()["required_permission"]) == (403, "field_data:write")
    assert (await outsider.get(notes)).status_code == 404
    assert (await outsider.get(f"{base}/notes/mentioning-me")).status_code == 404


async def test_closed_claims_are_read_only(
    auth_client: httpx2.AsyncClient, base: str, claim: dict[str, Any]
) -> None:
    claim_url = f"{base}/claims/{claim['id']}"
    cancelled = await auth_client.post(
        f"{claim_url}/status", json={"status": "cancelled", "reason": "Duplicate"}
    )
    assert cancelled.status_code == 200, cancelled.text

    locked = await auth_client.post(f"{claim_url}/notes", json={"body": "Too late"})
    assert (locked.status_code, locked.json()["code"]) == (409, "claim_locked")
    assert (await auth_client.get(f"{claim_url}/notes")).status_code == 200


async def test_notes_show_up_in_the_audit_timeline(
    auth_client: httpx2.AsyncClient, base: str, claim: dict[str, Any]
) -> None:
    await post(auth_client, f"{base}/claims/{claim['id']}/notes", {"body": "Called the carrier"})

    events = await auth_client.get(f"{base}/audit-events", params={"entity_type": "note"})

    [created] = events.json()["items"]
    assert created["actor"]["full_name"] == "Morgan Member"
    assert created["changes"]["body"] == [None, "Called the carrier"]
