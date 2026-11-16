"""Template logos: re-encoded as PNG, served by link, replaced and removed cleanly."""

import io
from typing import Any
from urllib.parse import urlsplit
from uuid import UUID

import httpx2
import pytest
from fastapi import FastAPI
from PIL import Image
from tests.conftest import ClientFor

from claimforge_api.reports import logos
from claimforge_api.users.models import Role


def image(size: tuple[int, int], fmt: str = "PNG", mode: str = "RGBA") -> bytes:
    out = io.BytesIO()
    Image.new(mode, size, (200, 30, 30, 128) if mode == "RGBA" else "teal").save(out, format=fmt)
    return out.getvalue()


def opened(data: bytes) -> Image.Image:
    found = Image.open(io.BytesIO(data))
    found.load()
    return found


def test_logos_are_shrunk_to_fit_and_kept_transparent() -> None:
    logo = opened(logos.normalize(image((3000, 1000))))

    assert (logo.format, logo.size, logo.mode) == ("PNG", (1200, 400), "RGBA")
    pixel = logo.getpixel((0, 0))
    assert isinstance(pixel, tuple)
    assert pixel[3] == 128  # transparency survives
    small = opened(logos.normalize(image((300, 80), "JPEG", "RGB")))
    assert (small.format, small.size) == ("PNG", (300, 80))  # never enlarged


@pytest.mark.parametrize(
    ("data", "message"),
    [
        (b"not an image at all", "readable image"),
        (image((40, 40), "GIF", "P"), "not GIF"),
        (b"x" * (logos.MAX_BYTES + 1), "2 MB"),
    ],
)
def test_what_isnt_a_logo(data: bytes, message: str) -> None:
    with pytest.raises(logos.LogoInvalidError, match=message):
        logos.normalize(data)


def path_of(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.path}?{parts.query}"


@pytest.fixture
async def template_url(auth_client: httpx2.AsyncClient, organization_id: UUID) -> str:
    url = f"/v1/organizations/{organization_id}/report-templates"
    template = (
        await auth_client.post(url, json={"kind": "photo_report", "name": "Carrier"})
    ).json()
    return f"{url}/{template['id']}"


async def put_logo(
    client: httpx2.AsyncClient, url: str, data: bytes, expect: int = 200
) -> dict[str, Any]:
    response = await client.put(f"{url}/logo", content=data, headers={"Content-Type": "image/png"})
    assert response.status_code == expect, response.text
    body: dict[str, Any] = response.json()
    return body


async def test_setting_replacing_and_removing(
    auth_client: httpx2.AsyncClient, client: httpx2.AsyncClient, template_url: str
) -> None:
    assert (await auth_client.get(template_url)).json()["logo_url"] is None

    first = await put_logo(auth_client, template_url, image((2400, 600)))
    served = await client.get(path_of(first["logo_url"]))
    assert served.headers["content-type"] == "image/png"
    assert opened(served.content).size == (1200, 300)

    second = await put_logo(auth_client, template_url, image((100, 100)))
    assert urlsplit(second["logo_url"]).path == urlsplit(first["logo_url"]).path  # same file
    assert opened((await client.get(path_of(second["logo_url"]))).content).size == (100, 100)

    removed = (await auth_client.delete(f"{template_url}/logo")).json()
    assert removed["logo_url"] is None
    assert (await client.get(path_of(second["logo_url"]))).status_code == 404


async def test_deleting_a_template_deletes_its_logo(
    auth_client: httpx2.AsyncClient, template_url: str, app: FastAPI
) -> None:
    with_logo = await put_logo(auth_client, template_url, image((100, 100)))
    key = urlsplit(with_logo["logo_url"]).path.removeprefix("/v1/storage/")

    await auth_client.delete(template_url)

    assert await app.state.storage.stat(key) is None


async def test_refusals(
    auth_client: httpx2.AsyncClient, client_for: ClientFor, template_url: str
) -> None:
    garbage = await put_logo(auth_client, template_url, b"definitely not a png", expect=422)
    assert garbage["code"] == "logo_invalid"
    technician = await client_for(Role.TECHNICIAN)
    refused = await technician.put(
        f"{template_url}/logo", content=image((10, 10)), headers={"Content-Type": "image/png"}
    )
    assert refused.status_code == 403
