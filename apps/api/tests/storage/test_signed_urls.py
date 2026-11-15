"""The API serving the local backend's signed URLs: no bearer token, the signature decides."""

import time
from collections.abc import AsyncIterator
from datetime import timedelta
from urllib.parse import urlsplit

import httpx2
import pytest
from fastapi import FastAPI

from claimforge_api.core.settings import Settings
from claimforge_api.storage.local import LocalStorage
from claimforge_api.storage.signing import UrlSigner

KEY = "org/claim/photo.jpg"
HOUR = timedelta(hours=1)


def path_of(url: str) -> str:
    """The URL relative to the API (the test client has its own host)."""
    parts = urlsplit(url)
    return f"{parts.path}?{parts.query}"


@pytest.fixture
def storage(app: FastAPI) -> LocalStorage:
    storage = app.state.storage
    assert isinstance(storage, LocalStorage)
    return storage


async def upload(
    client: httpx2.AsyncClient, storage: LocalStorage, data: bytes, content_type: str
) -> httpx2.Response:
    signed = await storage.upload_url(KEY, content_type=content_type, expires_in=HOUR)
    return await client.put(path_of(signed.url), content=data, headers=signed.headers)


async def test_upload_then_download(client: httpx2.AsyncClient, storage: LocalStorage) -> None:
    response = await upload(client, storage, b"jpeg bytes", "image/jpeg")
    assert response.status_code == 204, response.text

    downloaded = await client.get(path_of(await storage.download_url(KEY, expires_in=HOUR)))

    assert downloaded.status_code == 200
    assert downloaded.content == b"jpeg bytes"
    assert downloaded.headers["content-type"] == "image/jpeg"
    assert downloaded.headers["content-disposition"] == "inline"
    assert downloaded.headers["content-security-policy"] == "sandbox"
    assert downloaded.headers["x-content-type-options"] == "nosniff"
    cache, max_age = downloaded.headers["cache-control"].split(", ")
    assert cache == "private"
    assert 3590 <= int(max_age.removeprefix("max-age=")) <= 3600


async def test_downloads_under_a_file_name(
    client: httpx2.AsyncClient, storage: LocalStorage
) -> None:
    await storage.put(KEY, b"pdf", content_type="application/pdf")
    url = await storage.download_url(KEY, expires_in=HOUR, filename="Moisture map.pdf")

    downloaded = await client.get(path_of(url))
    assert downloaded.headers["content-disposition"] == (
        "attachment; filename=\"Moisture map.pdf\"; filename*=UTF-8''Moisture%20map.pdf"
    )
    # The name is part of the signature.
    renamed = await client.get(path_of(url).replace("Moisture", "Other"))
    assert renamed.status_code == 403
    assert renamed.json()["code"] == "invalid_signature"


async def test_the_signed_content_type_is_required(
    client: httpx2.AsyncClient, storage: LocalStorage
) -> None:
    signed = await storage.upload_url(KEY, content_type="image/jpeg", expires_in=HOUR)

    for headers in [{"Content-Type": "text/html"}, {}]:
        response = await client.put(path_of(signed.url), content=b"<script>", headers=headers)
        assert response.status_code == 403
        assert response.json()["code"] == "invalid_signature"
    assert await storage.stat(KEY) is None


async def test_links_only_do_what_they_were_signed_for(
    client: httpx2.AsyncClient, storage: LocalStorage
) -> None:
    await storage.put(KEY, b"secret", content_type="image/jpeg")
    download = path_of(await storage.download_url(KEY, expires_in=HOUR))
    upload_url = path_of(
        (await storage.upload_url(KEY, content_type="image/jpeg", expires_in=HOUR)).url
    )

    attempts = [
        ("GET", download.replace("photo.jpg", "other.jpg")),  # another object
        ("PUT", download),  # a download link can't replace the object
        ("GET", upload_url),  # an upload link can't read it
        ("GET", download.replace("expires=", "expires=9")),  # a longer life
        ("GET", download.split("&signature=")[0] + "&signature=" + "0" * 64),
    ]
    for method, url in attempts:
        response = await client.request(
            method, url, content=b"x", headers={"Content-Type": "image/jpeg"}
        )
        assert response.status_code == 403, (method, url)
        assert response.json()["code"] == "invalid_signature"
    assert await storage.get(KEY) == b"secret"


async def test_expired_links(
    client: httpx2.AsyncClient, settings: Settings, storage: LocalStorage
) -> None:
    # The same storage, two hours ago: its one-hour links have expired.
    earlier = LocalStorage(
        settings.storage_local_root,
        signer=UrlSigner(settings.jwt_secret.get_secret_value().encode("utf-8")),
        base_url=settings.public_api_url,
        clock=lambda: time.time() - 7200,
    )
    await storage.put(KEY, b"old", content_type="image/jpeg")

    download = await client.get(path_of(await earlier.download_url(KEY, expires_in=HOUR)))
    signed = await earlier.upload_url(KEY, content_type="image/jpeg", expires_in=HOUR)
    upload_response = await client.put(path_of(signed.url), content=b"new", headers=signed.headers)

    for response in (download, upload_response):
        assert response.status_code == 403
        assert response.json()["code"] == "signature_expired"
    assert await storage.get(KEY) == b"old"


async def test_upload_size_is_capped(
    client: httpx2.AsyncClient, settings: Settings, storage: LocalStorage, app: FastAPI
) -> None:
    app.state.settings = settings.model_copy(update={"storage_max_upload_bytes": 4})

    declared = await upload(client, storage, b"12345", "image/jpeg")

    async def chunks() -> AsyncIterator[bytes]:
        for chunk in (b"12", b"34", b"5"):
            yield chunk

    signed = await storage.upload_url(KEY, content_type="image/jpeg", expires_in=HOUR)
    streamed = await client.put(path_of(signed.url), content=chunks(), headers=signed.headers)

    for response in (declared, streamed):
        assert response.status_code == 413
        assert response.json()["code"] == "upload_too_large"
        assert response.json()["limit"] == 4
    assert await storage.stat(KEY) is None
    assert (await upload(client, storage, b"1234", "image/jpeg")).status_code == 204


async def test_missing_objects_and_unsafe_keys(
    client: httpx2.AsyncClient, storage: LocalStorage
) -> None:
    missing = await client.get(path_of(await storage.download_url(KEY, expires_in=HOUR)))
    assert missing.status_code == 404

    unsafe = await client.get("/v1/storage/.hidden?expires=1&signature=x")
    assert unsafe.status_code == 404


async def test_only_served_for_the_local_backend(
    client: httpx2.AsyncClient, storage: LocalStorage, app: FastAPI
) -> None:
    url = path_of(await storage.download_url(KEY, expires_in=HOUR))
    await storage.put(KEY, b"x", content_type="image/jpeg")
    app.state.storage = object()  # any other backend serves its own URLs

    assert (await client.get(url)).status_code == 404
