"""The photo report: photos by room, as many per page as the template says, labelled."""

import io
from typing import Any

import pytest
from PIL import Image
from pypdf import PdfReader
from tests.photos.conftest import Site

from claimforge_api.photos import processing
from claimforge_api.reports import photo_report, service
from claimforge_api.reports.schemas import TemplateCreate
from claimforge_api.structures import service as structures
from claimforge_api.structures.models import Room
from claimforge_api.structures.schemas import RoomCreate, StructureCreate


def jpeg(size: tuple[int, int] = (1600, 1200)) -> bytes:
    out = io.BytesIO()
    Image.new("RGB", size, "teal").save(out, format="JPEG")
    return out.getvalue()


async def room(site: Site, name: str) -> Room:
    house = await structures.create_structure(
        site.session,
        site.organization_id,
        site.claim.id,
        StructureCreate(name=f"{name} wing"),
        user=site.user,
    )
    return await structures.create_room(
        site.session,
        site.organization_id,
        site.claim.id,
        house.id,
        RoomCreate(name=name),
        user=site.user,
    )


async def template(site: Site, **options: Any) -> None:
    await service.create_template(
        site.session,
        site.organization_id,
        TemplateCreate.model_validate(
            {"kind": "photo_report", "name": "Carrier", "is_default": True, "options": options}
        ),
        user=site.user,
    )


async def render(site: Site) -> list[str]:
    pdf = await photo_report.render(
        site.session, site.storage, site.organization_id, site.claim.id, prepared_by=site.user
    )
    return [page.extract_text() for page in PdfReader(io.BytesIO(pdf)).pages]


async def test_photos_by_room(site: Site) -> None:
    kitchen, bath = await room(site, "Kitchen"), await room(site, "Bath")
    for n in range(3):
        await site.photo(jpeg(), room_id=str(kitchen.id), caption=f"Kitchen {n}", tags=["before"])
    await site.photo(jpeg((800, 1200)), room_id=str(bath.id), caption="Vanity")
    await site.photo(b"\xff\xd8 not a real jpeg", room_id=str(bath.id), caption="Broken")
    await site.photo(jpeg(), caption="Front of house")
    while await processing.process_next(site.session, site.storage):
        pass  # previews for the readable ones; the broken one fails processing
    await template(site, photos_per_page=4, show_tags=True)

    pages = await render(site)

    assert "Photos" in pages[0]
    assert "6" in pages[0]  # the count on the cover
    assert len(pages) == 4  # cover, kitchen, bath, no room
    assert "Kitchen" in pages[1]
    assert all(f"Kitchen {n}" in pages[1] for n in range(3))
    assert "before" in pages[1]  # tags shown
    assert "Vanity" in pages[2]
    assert "Image unavailable" in pages[2]  # the broken file, not a broken report
    assert "Photos without a room" in pages[3]
    assert "Front of house" in pages[3]


async def test_layout_follows_the_template(site: Site) -> None:
    kitchen = await room(site, "Kitchen")
    for n in range(3):
        await site.photo(jpeg(), room_id=str(kitchen.id), caption=f"Shot {n}", tags=["after"])
    await template(site, photos_per_page=1, group_by_room=False, show_tags=False)

    pages = await render(site)

    assert len(pages) == 4  # cover and a page per photo
    assert "Kitchen" not in "".join(pages[1:])  # not grouped: no room headings
    assert "after" not in "".join(pages[1:])


async def test_unprocessed_photos_use_their_original(site: Site) -> None:
    await site.photo(jpeg(), caption="Fresh off the phone")  # no worker run yet

    pages = await render(site)

    assert "Fresh off the phone" in pages[1]
    assert "Image unavailable" not in pages[1]


async def test_a_claim_without_photos(site: Site) -> None:
    pages = await render(site)

    assert len(pages) == 2
    assert "No photos have been added" in pages[1]


@pytest.mark.parametrize("per_page", [1, 2, 4, 6])
async def test_every_grid_fits_its_page(site: Site, per_page: int) -> None:
    for n in range(per_page * 2 + 1):  # two full pages and one more photo
        await site.photo(jpeg((1200, 1600) if n % 2 else (1600, 1200)), caption=f"Photo {n}")
    await template(site, photos_per_page=per_page, group_by_room=False)

    pages = await render(site)

    assert len(pages) == 1 + 3  # the cover, then nothing spilling onto extra pages
