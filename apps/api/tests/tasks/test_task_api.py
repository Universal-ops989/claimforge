"""Claim tasks over HTTP: assigning, completing, "assigned to me", roles and tenants."""

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


async def test_assign_complete_and_delete(
    auth_client: httpx2.AsyncClient, client_for: ClientFor, base: str, claim: dict[str, Any]
) -> None:
    technician = await client_for(Role.TECHNICIAN)
    tech_id = await me(technician)
    tasks = f"{base}/claims/{claim['id']}/tasks"

    task = await post(
        auth_client,
        tasks,
        {"title": "Set dehus", "due_on": "2026-11-17", "assignee_id": tech_id},
    )
    assert (task["assignee"]["id"], task["due_on"], task["done"]) == (tech_id, "2026-11-17", False)
    assert task["claim"] == {"id": claim["id"], "number": claim["number"]}

    mine = (await technician.get(f"{base}/tasks/assigned-to-me")).json()
    assert [t["id"] for t in mine["items"]] == [task["id"]]

    url = f"{tasks}/{task['id']}"
    done = await technician.patch(url, json={"done": True})
    assert done.status_code == 200, done.text
    assert (done.json()["done"], done.json()["completed_by_id"]) == (True, tech_id)
    assert (await technician.get(f"{base}/tasks/assigned-to-me")).json()["items"] == []
    finished = await technician.get(f"{base}/tasks/assigned-to-me", params={"status": "done"})
    assert len(finished.json()["items"]) == 1

    listed = await auth_client.get(tasks, params={"status": "done"})
    assert [t["title"] for t in listed.json()] == ["Set dehus"]
    assert (await auth_client.delete(url)).status_code == 204
    assert (await auth_client.get(tasks)).json() == []


async def test_assigned_to_me_filters_and_pages(
    auth_client: httpx2.AsyncClient, base: str, claim: dict[str, Any]
) -> None:
    my_id = await me(auth_client)
    tasks = f"{base}/claims/{claim['id']}/tasks"
    for title, due in [("later", "2026-11-20"), ("undated", None), ("soon", "2026-11-16")]:
        await post(auth_client, tasks, {"title": title, "due_on": due, "assignee_id": my_id})

    mine = f"{base}/tasks/assigned-to-me"
    first = (await auth_client.get(mine, params={"limit": 2})).json()
    rest = (await auth_client.get(mine, params={"limit": 2, "cursor": first["next_cursor"]})).json()
    due = (await auth_client.get(mine, params={"due_by": "2026-11-18"})).json()

    assert [t["title"] for t in first["items"] + rest["items"]] == ["soon", "later", "undated"]
    assert [t["title"] for t in due["items"]] == ["soon"]


async def test_problems(
    auth_client: httpx2.AsyncClient, client_for: ClientFor, base: str, claim: dict[str, Any]
) -> None:
    tasks = f"{base}/claims/{claim['id']}/tasks"
    viewer_id = await me(await client_for(Role.VIEWER))

    unable = await auth_client.post(tasks, json={"title": "Read meters", "assignee_id": viewer_id})
    assert (unable.status_code, unable.json()["code"], unable.json()["assignee_needs"]) == (
        422,
        "assignee_lacks_permission",
        "field_data:write",
    )
    stranger = await auth_client.post(tasks, json={"title": "X", "assignee_id": str(uuid4())})
    assert (stranger.status_code, stranger.json()["code"]) == (422, "unknown_assignee")
    for body in [{"title": ""}, {"title": "X", "due_on": "someday"}, {"title": "X", "done": True}]:
        assert (await auth_client.post(tasks, json=body)).status_code == 422, body

    task = await post(auth_client, tasks, {"title": "Mine"})
    technician = await client_for(Role.TECHNICIAN)
    not_mine = await technician.delete(f"{tasks}/{task['id']}")
    assert (not_mine.status_code, not_mine.json()["code"]) == (403, "not_task_creator")
    assert (await auth_client.patch(f"{tasks}/{uuid4()}", json={"done": True})).status_code == 404


async def test_roles_and_tenants(
    auth_client: httpx2.AsyncClient, client_for: ClientFor, base: str, claim: dict[str, Any]
) -> None:
    tasks = f"{base}/claims/{claim['id']}/tasks"
    await post(auth_client, tasks, {"title": "Visible to members"})
    viewer = await client_for(Role.VIEWER)
    outsider = await client_for(None)

    assert len((await viewer.get(tasks)).json()) == 1
    denied = await viewer.post(tasks, json={"title": "Me too"})
    assert (denied.status_code, denied.json()["required_permission"]) == (403, "field_data:write")
    assert (await outsider.get(tasks)).status_code == 404
    assert (await outsider.get(f"{base}/tasks/assigned-to-me")).status_code == 404


async def test_closed_claims_are_read_only(
    auth_client: httpx2.AsyncClient, base: str, claim: dict[str, Any]
) -> None:
    claim_url = f"{base}/claims/{claim['id']}"
    cancelled = await auth_client.post(
        f"{claim_url}/status", json={"status": "cancelled", "reason": "Duplicate"}
    )
    assert cancelled.status_code == 200, cancelled.text

    locked = await auth_client.post(f"{claim_url}/tasks", json={"title": "Too late"})
    assert (locked.status_code, locked.json()["code"]) == (409, "claim_locked")
    assert (await auth_client.get(f"{claim_url}/tasks")).status_code == 200


async def test_tasks_show_up_in_the_audit_timeline(
    auth_client: httpx2.AsyncClient, base: str, claim: dict[str, Any]
) -> None:
    await post(auth_client, f"{base}/claims/{claim['id']}/tasks", {"title": "Call the carrier"})

    events = await auth_client.get(f"{base}/audit-events", params={"entity_type": "task"})

    [created] = events.json()["items"]
    assert created["actor"]["full_name"] == "Morgan Member"
    assert created["changes"]["title"] == [None, "Call the carrier"]
