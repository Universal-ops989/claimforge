"""Captions, tags and rooms over HTTP: at upload, by PATCH, as filters and suggestions."""

from typing import Any
from urllib.parse import urlsplit
from uuid import UUID

import httpx2
import pytest
from tests.conftest import ClientFor

from claimforge_api.users.models import Role

ADDRESS = {"line1": "123 Main St", "city": "Austin", "region": "TX", "postal_code": "78701"}
JPEG = b"\xff\xd8\xff\xe0 water stain on the ceiling"


async def send(client: httpx2.AsyncClient, method: str, url: str, **body: Any) -> dict[str, Any]:
    response = await client.request(method, url, json=body or None)
    assert response.status_code < 300, response.text
    payload: dict[str, Any] = response.json() if response.content else {}
    return payload


@pytest.fixture
def base(organization_id: UUID) -> str:
    return f"/v1/organizations/{organization_id}"


@pytest.fixture
async def url(auth_client: httpx2.AsyncClient, base: str) -> str:
    claim = await send(
        auth_client, "POST", f"{base}/claims", loss_type="water", property={"address": ADDRESS}
    )
    return f"{base}/claims/{claim['id']}"


@pytest.fixture
async def rooms(auth_client: httpx2.AsyncClient, url: str) -> dict[str, str]:
    house = await send(auth_client, "POST", f"{url}/structures", name="Main house")
    found = {}
    for name in ("Kitchen", "Bath"):
        made = await send(auth_client, "POST", f"{url}/structures/{house['id']}/rooms", name=name)
        found[name] = made["id"]
    return found


async def upload(
    auth_client: httpx2.AsyncClient, client: httpx2.AsyncClient, url: str, **details: Any
) -> dict[str, Any]:
    started = await send(
        auth_client,
        "POST",
        f"{url}/photo-uploads",
        filename="IMG_0412.jpg",
        content_type="image/jpeg",
        size_bytes=len(JPEG),
        **details,
    )
    link = started["upload"]
    parts = urlsplit(link["url"])
    sent = await client.put(f"{parts.path}?{parts.query}", content=JPEG, headers=link["headers"])
    assert sent.status_code == 204, sent.text
    return await send(auth_client, "POST", f"{url}/photo-uploads/{started['id']}/complete")


async def ids(client: httpx2.AsyncClient, url: str, **params: Any) -> list[str]:
    response = await client.get(f"{url}/photos", params=params)
    assert response.status_code == 200, response.text
    return [p["id"] for p in response.json()["items"]]


async def test_details_from_upload_to_edit(
    auth_client: httpx2.AsyncClient,
    client: httpx2.AsyncClient,
    url: str,
    rooms: dict[str, str],
) -> None:
    photo = await upload(
        auth_client,
        client,
        url,
        caption="Stain by the vent",
        tags=["Before", "ceiling"],
        room_id=rooms["Kitchen"],
    )
    assert (photo["caption"], photo["tags"]) == ("Stain by the vent", ["before", "ceiling"])
    assert photo["room"] == {"id": rooms["Kitchen"], "name": "Kitchen"}

    moved = await send(
        auth_client, "PATCH", f"{url}/photos/{photo['id']}", room_id=rooms["Bath"], tags=["After"]
    )
    assert (moved["caption"], moved["tags"], moved["room"]["name"]) == (
        "Stain by the vent",
        ["after"],
        "Bath",
    )
    assert moved["url"]  # fresh links, like every read
    unlinked = await send(auth_client, "PATCH", f"{url}/photos/{photo['id']}", room_id=None)
    assert unlinked["room"] is None

    timeline = (await auth_client.get(f"{url}/timeline", params={"kind": "photos"})).json()
    assert [entry["summary"] for entry in timeline["items"]] == [
        "Took photo IMG_0412.jpg out of its room",
        "Moved photo IMG_0412.jpg to another room",
        "Added photo IMG_0412.jpg",
    ]


async def test_filters(
    auth_client: httpx2.AsyncClient,
    client: httpx2.AsyncClient,
    url: str,
    rooms: dict[str, str],
) -> None:
    kitchen = await upload(auth_client, client, url, room_id=rooms["Kitchen"], tags=["before"])
    both = await upload(
        auth_client, client, url, room_id=rooms["Kitchen"], tags=["before", "ceiling"]
    )
    loose = await upload(auth_client, client, url, tags=["ceiling"])

    assert await ids(auth_client, url, room_id=rooms["Kitchen"]) == [both["id"], kitchen["id"]]
    assert await ids(auth_client, url, unassigned="true") == [loose["id"]]
    assert await ids(auth_client, url, tag=["Before", "ceiling"]) == [both["id"]]
    assert await ids(auth_client, url, tag="ceiling") == [loose["id"], both["id"]]

    both_filters = await auth_client.get(
        f"{url}/photos", params={"room_id": rooms["Kitchen"], "unassigned": "true"}
    )
    assert both_filters.status_code == 422


async def test_tag_suggestions(
    auth_client: httpx2.AsyncClient,
    client: httpx2.AsyncClient,
    client_for: ClientFor,
    base: str,
    url: str,
) -> None:
    await upload(auth_client, client, url, tags=["before", "ceiling"])
    await upload(auth_client, client, url, tags=["before", "cabinet"])
    viewer = await client_for(Role.VIEWER)

    everything = (await viewer.get(f"{base}/photo-tags")).json()
    assert everything == [
        {"tag": "before", "photos": 2},
        {"tag": "cabinet", "photos": 1},
        {"tag": "ceiling", "photos": 1},
    ]
    typed = (await viewer.get(f"{base}/photo-tags", params={"prefix": "Ce", "limit": 5})).json()
    assert typed == [{"tag": "ceiling", "photos": 1}]
    assert (await viewer.get(f"{base}/photo-tags", params={"limit": 101})).status_code == 422


async def test_problems(
    auth_client: httpx2.AsyncClient,
    client: httpx2.AsyncClient,
    client_for: ClientFor,
    base: str,
    url: str,
) -> None:
    photo = await upload(auth_client, client, url)
    other = await send(
        auth_client, "POST", f"{base}/claims", loss_type="fire", property={"address": ADDRESS}
    )
    house = await send(auth_client, "POST", f"{base}/claims/{other['id']}/structures", name="Shed")
    their_room = await send(
        auth_client,
        "POST",
        f"{base}/claims/{other['id']}/structures/{house['id']}/rooms",
        name="Shed",
    )
    edit = f"{url}/photos/{photo['id']}"

    unknown = await auth_client.patch(edit, json={"room_id": their_room["id"]})
    assert unknown.status_code == 422
    assert unknown.json()["code"] == "unknown_room"
    for body in ({"tags": None}, {"tags": ["no!"]}, {"caption": "x" * 2001}, {"filename": "a"}):
        assert (await auth_client.patch(edit, json=body)).status_code == 422, body

    viewer = await client_for(Role.VIEWER)
    assert (await viewer.patch(edit, json={"caption": "Mine"})).status_code == 403
