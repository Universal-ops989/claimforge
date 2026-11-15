"""Claim photos over HTTP: the whole upload through the local backend's signed links."""

from typing import Any
from urllib.parse import urlsplit
from uuid import UUID, uuid4

import httpx2
import pytest
from fastapi import FastAPI
from tests.conftest import ClientFor

from claimforge_api.storage.base import StorageUnavailableError
from claimforge_api.users.models import Role

ADDRESS = {"line1": "123 Main St", "city": "Austin", "region": "TX", "postal_code": "78701"}
JPEG = b"\xff\xd8\xff\xe0 water stain on the ceiling"


def path_of(url: str) -> str:
    """A storage link relative to the API (the test client has its own host)."""
    parts = urlsplit(url)
    return f"{parts.path}?{parts.query}"


async def send(client: httpx2.AsyncClient, method: str, url: str, **body: Any) -> dict[str, Any]:
    response = await client.request(method, url, json=body or None)
    assert response.status_code < 300, response.text
    payload: dict[str, Any] = response.json() if response.content else {}
    return payload


@pytest.fixture
async def url(auth_client: httpx2.AsyncClient, organization_id: UUID) -> str:
    base = f"/v1/organizations/{organization_id}"
    claim = await send(
        auth_client, "POST", f"{base}/claims", loss_type="water", property={"address": ADDRESS}
    )
    return f"{base}/claims/{claim['id']}"


def described(data: bytes = JPEG, **fields: Any) -> dict[str, Any]:
    return {
        "filename": "IMG_0412.jpg",
        "content_type": "image/jpeg",
        "size_bytes": len(data),
    } | fields


async def start(client: httpx2.AsyncClient, url: str, **fields: Any) -> dict[str, Any]:
    response = await client.post(f"{url}/photo-uploads", json=described(**fields))
    assert response.status_code == 201, response.text
    payload: dict[str, Any] = response.json()
    return payload


async def put_file(
    anonymous: httpx2.AsyncClient, upload: dict[str, Any], data: bytes = JPEG
) -> None:
    """Follow the signed link as a phone would: no bearer token, just the link."""
    link = upload["upload"]
    response = await anonymous.request(
        link["method"], path_of(link["url"]), content=data, headers=link["headers"]
    )
    assert response.status_code < 300, response.text


async def test_upload_view_and_delete(
    auth_client: httpx2.AsyncClient, client: httpx2.AsyncClient, url: str
) -> None:
    upload = await start(auth_client, url, taken_at="2026-11-14T09:30:00-06:00")
    assert upload["upload"]["method"] == "PUT"
    assert upload["upload"]["headers"] == {"Content-Type": "image/jpeg"}
    await put_file(client, upload)

    completed = await auth_client.post(f"{url}/photo-uploads/{upload['id']}/complete")
    assert completed.status_code == 201, completed.text
    photo = completed.json()
    assert photo["id"] == upload["id"]
    assert photo["filename"] == "IMG_0412.jpg"
    assert photo["size_bytes"] == len(JPEG)
    assert photo["taken_at"] == "2026-11-14T15:30:00Z"
    assert photo["uploaded_by"]["full_name"] == "Morgan Member"

    # Retrying is safe.
    again = await auth_client.post(f"{url}/photo-uploads/{upload['id']}/complete")
    assert again.status_code == 200
    assert again.json()["id"] == photo["id"]

    listed = (await auth_client.get(f"{url}/photos")).json()
    assert [p["id"] for p in listed["items"]] == [photo["id"]]
    fetched = (await auth_client.get(f"{url}/photos/{photo['id']}")).json()
    shown = await auth_client.get(path_of(fetched["url"]))
    assert shown.content == JPEG
    assert shown.headers["content-disposition"] == "inline"
    saved = await auth_client.get(path_of(fetched["download_url"]))
    assert saved.headers["content-disposition"].startswith('attachment; filename="IMG_0412.jpg"')

    assert (await auth_client.delete(f"{url}/photos/{photo['id']}")).status_code == 204
    assert (await auth_client.get(f"{url}/photos/{photo['id']}")).status_code == 404
    assert (await auth_client.get(path_of(fetched["url"]))).status_code == 404

    timeline = (await auth_client.get(f"{url}/timeline", params={"kind": "photos"})).json()
    assert [entry["summary"] for entry in timeline["items"]] == [
        "Deleted photo IMG_0412.jpg",
        "Added photo IMG_0412.jpg",
    ]


async def test_the_file_is_checked(
    auth_client: httpx2.AsyncClient, client: httpx2.AsyncClient, url: str
) -> None:
    upload = await start(auth_client, url)
    complete = f"{url}/photo-uploads/{upload['id']}/complete"

    early = await auth_client.post(complete)
    assert early.status_code == 409
    assert early.json()["code"] == "upload_not_received"

    await put_file(client, upload, JPEG + b" and more")
    mismatch = await auth_client.post(complete)
    assert mismatch.status_code == 422
    problem = mismatch.json()
    assert problem["code"] == "upload_mismatch"
    assert (problem["expected_size"], problem["received_size"]) == (len(JPEG), len(JPEG) + 9)

    await put_file(client, upload)
    assert (await auth_client.post(complete)).status_code == 201


async def test_problems(auth_client: httpx2.AsyncClient, client_for: ClientFor, url: str) -> None:
    too_large = await auth_client.post(
        f"{url}/photo-uploads", json=described(size_bytes=25 * 1024 * 1024 + 1)
    )
    assert too_large.status_code == 422
    assert too_large.json()["code"] == "photo_too_large"
    assert too_large.json()["limit"] == 25 * 1024 * 1024

    for fields in ({"content_type": "image/gif"}, {"size_bytes": 0}, {"filename": ""}):
        response = await auth_client.post(f"{url}/photo-uploads", json=described(**fields))
        assert response.status_code == 422, fields

    unknown = await auth_client.post(f"{url}/photo-uploads/{uuid4()}/complete")
    assert unknown.status_code == 404

    viewer = await client_for(Role.VIEWER)
    refused = await viewer.post(f"{url}/photo-uploads", json=described())
    assert refused.status_code == 403
    assert (await viewer.get(f"{url}/photos")).status_code == 200


async def test_pages_of_photos(
    auth_client: httpx2.AsyncClient, client: httpx2.AsyncClient, url: str
) -> None:
    ids = []
    for name in ("one.jpg", "two.jpg", "three.jpg"):
        upload = await start(auth_client, url, filename=name)
        await put_file(client, upload)
        await send(auth_client, "POST", f"{url}/photo-uploads/{upload['id']}/complete")
        ids.append(upload["id"])

    first = (await auth_client.get(f"{url}/photos", params={"limit": 2})).json()
    rest = (
        await auth_client.get(f"{url}/photos", params={"limit": 2, "cursor": first["next_cursor"]})
    ).json()

    assert [p["id"] for p in first["items"] + rest["items"]] == ids[::-1]
    assert (first["has_more"], rest["has_more"]) == (True, False)


class DownStorage:
    async def upload_url(self, *_: object, **__: object) -> None:
        raise StorageUnavailableError("connection refused")


async def test_a_storage_outage_is_503(
    auth_client: httpx2.AsyncClient, app: FastAPI, url: str
) -> None:
    app.state.storage = DownStorage()

    response = await auth_client.post(f"{url}/photo-uploads", json=described())

    assert response.status_code == 503
    assert response.headers["retry-after"] == "30"
    assert response.json()["code"] == "storage_unavailable"
    assert "connection refused" not in response.text
