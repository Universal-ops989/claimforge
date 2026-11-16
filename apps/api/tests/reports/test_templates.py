"""Report templates: options checked by kind, one default per kind, the built-in fallback."""

from typing import Any
from uuid import UUID

import httpx2
import pytest
from tests.conftest import ClientFor

from claimforge_api.users.models import Role


@pytest.fixture
def url(organization_id: UUID) -> str:
    return f"/v1/organizations/{organization_id}/report-templates"


async def send(
    client: httpx2.AsyncClient, method: str, url: str, expect: int = 0, **body: Any
) -> Any:
    response = await client.request(method, url, json=body if body else None)
    if expect:
        assert response.status_code == expect, response.text
    else:
        assert response.status_code < 300, response.text
    return response.json() if response.content else None


async def effective(client: httpx2.AsyncClient, url: str, kind: str) -> dict[str, Any]:
    response = await client.get(f"{url}/effective", params={"kind": kind})
    assert response.status_code == 200, response.text
    found: dict[str, Any] = response.json()
    return found


async def test_built_in_until_one_is_set_up(auth_client: httpx2.AsyncClient, url: str) -> None:
    built_in = await effective(auth_client, url, "photo_report")
    assert (built_in["id"], built_in["built_in"], built_in["title"]) == (None, True, "Photo Report")
    assert built_in["options"] == {
        "photos_per_page": 2,
        "show_captions": True,
        "show_tags": False,
        "show_taken_at": True,
        "group_by_room": True,
    }

    template = await send(
        auth_client,
        "POST",
        url,
        kind="photo_report",
        name="Carrier photo report",
        header_text="Rivera Restoration · (512) 555-0100",
        footer_text="TX license #12345",
        accent_color="#AA3300",
        options={"photos_per_page": 4},
        is_default=True,
    )
    assert template["options"]["photos_per_page"] == 4
    assert template["options"]["show_captions"] is True  # filled in
    assert template["title"] == "Photo Report"  # the kind's, until set
    chosen = await effective(auth_client, url, "photo_report")
    assert (chosen["id"], chosen["built_in"]) == (template["id"], False)
    # The other kind still uses its built-in.
    assert (await effective(auth_client, url, "drying_report"))["built_in"] is True

    await send(auth_client, "DELETE", f"{url}/{template['id']}", 204)
    assert (await effective(auth_client, url, "photo_report"))["built_in"] is True


async def test_options_belong_to_the_kind(auth_client: httpx2.AsyncClient, url: str) -> None:
    wrong: list[dict[str, Any]] = [
        {"kind": "drying_report", "options": {"photos_per_page": 2}},
        {"kind": "photo_report", "options": {"photos_per_page": 3}},
        {"kind": "photo_report", "options": {"watermark": True}},
        {"kind": "photo_report", "accent_color": "red"},
        {"kind": "invoice"},
    ]
    for body in wrong:
        response = await auth_client.post(url, json={"name": "X"} | body)
        assert response.status_code == 422, body

    drying = await send(
        auth_client,
        "POST",
        url,
        kind="drying_report",
        name="Drying",
        options={"include_alerts": False},
    )
    assert drying["options"] == {
        "include_atmosphere": True,
        "include_equipment": True,
        "include_alerts": False,
    }
    # Options are replaced as a whole: what's left out goes back to its default.
    edited = await send(
        auth_client, "PATCH", f"{url}/{drying['id']}", options={"include_equipment": False}
    )
    assert edited["options"]["include_alerts"] is True
    assert edited["options"]["include_equipment"] is False
    fixed_kind = await auth_client.patch(f"{url}/{drying['id']}", json={"kind": "photo_report"})
    assert fixed_kind.status_code == 422


async def test_one_default_per_kind_and_unique_names(
    auth_client: httpx2.AsyncClient, url: str
) -> None:
    first = await send(auth_client, "POST", url, kind="photo_report", name="A", is_default=True)
    await send(auth_client, "POST", url, kind="drying_report", name="B", is_default=True)
    second = await send(auth_client, "POST", url, kind="photo_report", name="C", is_default=True)

    photos = await send(auth_client, "GET", f"{url}?kind=photo_report")
    assert [(t["name"], t["is_default"]) for t in photos] == [("C", True), ("A", False)]
    assert (await send(auth_client, "GET", f"{url}/{first['id']}"))["is_default"] is False
    everything = await send(auth_client, "GET", url)
    assert [t["kind"] for t in everything] == ["drying_report", "photo_report", "photo_report"]

    taken = await send(auth_client, "POST", url, 409, kind="drying_report", name="c")
    assert taken["code"] == "template_name_taken"
    renamed = await send(auth_client, "PATCH", f"{url}/{first['id']}", 409, name="C")
    assert renamed["code"] == "template_name_taken"
    assert (await send(auth_client, "PATCH", f"{url}/{second['id']}", title="Site photos"))[
        "title"
    ] == "Site photos"


async def test_access(auth_client: httpx2.AsyncClient, client_for: ClientFor, url: str) -> None:
    await send(auth_client, "POST", url, kind="photo_report", name="A")
    technician = await client_for(Role.TECHNICIAN)
    viewer = await client_for(Role.VIEWER)

    assert len(await send(viewer, "GET", url)) == 1
    await send(technician, "POST", url, 403, kind="photo_report", name="Mine")
