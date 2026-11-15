"""Captions, tags and rooms: set at upload, edited later, filtered on, suggested."""

from typing import Any
from uuid import UUID

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from tests.photos.conftest import Site, member, open_claim

from claimforge_api.audit.models import AuditEvent
from claimforge_api.claims import service as claims
from claimforge_api.claims.schemas import ClaimStatusChangeCreate
from claimforge_api.core.errors import PermissionDeniedError
from claimforge_api.organizations import service as organizations
from claimforge_api.organizations.schemas import OrganizationCreate
from claimforge_api.photos import service
from claimforge_api.photos.models import Photo
from claimforge_api.photos.schemas import PhotoListQuery, PhotoUpdate
from claimforge_api.structures import service as structures
from claimforge_api.structures.models import Room
from claimforge_api.structures.schemas import RoomCreate, StructureCreate
from claimforge_api.users.models import Role


async def room(site: Site, name: str) -> Room:
    structure = await structures.create_structure(
        site.session,
        site.organization_id,
        site.claim.id,
        StructureCreate(name=f"House {name}"),
        user=site.user,
    )
    return await structures.create_room(
        site.session,
        site.organization_id,
        site.claim.id,
        structure.id,
        RoomCreate(name=name),
        user=site.user,
    )


async def edit(site: Site, photo: Photo, **fields: Any) -> Photo:
    return await service.update_photo(
        site.session,
        site.organization_id,
        site.claim.id,
        photo.id,
        PhotoUpdate.model_validate(fields),
        user=site.user,
    )


async def find(site: Site, **filters: Any) -> list[UUID]:
    page = await service.list_photos(
        site.session,
        site.organization_id,
        site.claim.id,
        PhotoListQuery.model_validate(filters),
        user=site.user,
        limit=50,
        cursor=None,
    )
    return [p.id for p in page.items]


async def updates(session: AsyncSession, photo_id: UUID) -> list[dict[str, Any]]:
    events = await session.scalars(
        select(AuditEvent.changes).where(
            AuditEvent.entity_id == photo_id, AuditEvent.action == "photo.updated"
        )
    )
    return list(events)


async def test_details_given_at_upload(site: Site) -> None:
    kitchen = await room(site, "Kitchen")

    photo = await site.photo(
        caption="  Stain spreading from the vent ",
        tags=["Before", " ceiling  stain", "before"],
        room_id=str(kitchen.id),
    )

    assert photo.caption == "Stain spreading from the vent"
    assert photo.tags == ["before", "ceiling stain"]
    shown = await service.present(site.storage, photo)
    assert shown.room is not None
    assert (shown.room.id, shown.room.name) == (kitchen.id, "Kitchen")


async def test_editing(site: Site) -> None:
    kitchen = await room(site, "Kitchen")
    photo = await site.photo(caption="Stain", tags=["before"])

    edited = await edit(site, photo, tags=["after", "Before"], room_id=str(kitchen.id))
    assert (edited.caption, edited.tags, edited.room_id) == (
        "Stain",
        ["after", "before"],
        kitchen.id,
    )

    # Blank clears the caption; null takes the photo out of its room.
    cleared = await edit(site, photo, caption="  ", room_id=None, tags=[])
    assert (cleared.caption, cleared.tags, cleared.room_id) == (None, [], None)

    changes = await updates(site.session, photo.id)
    assert changes[0]["tags"] == [["before"], ["after", "before"]]
    assert changes[0]["room_id"] == [None, str(kitchen.id)]
    assert changes[1]["caption"] == ["Stain", None]
    # Saying the same thing again leaves no history.
    await edit(site, photo, caption=None, tags=[])
    assert len(await updates(site.session, photo.id)) == 2


async def test_rooms_must_be_on_the_claim(site: Site) -> None:
    elsewhere = Site(
        site.session,
        site.storage,
        site.organization_id,
        await open_claim(site.session, site.organization_id, site.user),
        site.user,
    )
    their_room = await room(elsewhere, "Garage")
    photo = await site.photo()

    with pytest.raises(service.UnknownRoomError):
        await site.start(room_id=str(their_room.id))
    with pytest.raises(service.UnknownRoomError):
        await edit(site, photo, room_id=str(their_room.id))

    # The database agrees, whatever the service does.
    photo.room_id = their_room.id
    with pytest.raises(IntegrityError):
        await site.session.flush()
    await site.session.rollback()


async def test_deleting_a_room_unlinks_its_photos(site: Site) -> None:
    kitchen = await room(site, "Kitchen")
    photo = await site.photo(room_id=str(kitchen.id))
    pending = await site.start(room_id=str(kitchen.id))
    await site.send(pending)

    await structures.delete_room(
        site.session, site.organization_id, site.claim.id, kitchen.id, user=site.user
    )

    [listed] = [p for p in await site.photos() if p.id == photo.id]
    assert listed.room_id is None
    completed, _ = await site.complete(pending.id)  # its room went while it was uploading
    assert completed.room_id is None


async def test_filters(site: Site) -> None:
    kitchen, bath = await room(site, "Kitchen"), await room(site, "Bath")
    before_kitchen = await site.photo(room_id=str(kitchen.id), tags=["before", "ceiling"])
    after_kitchen = await site.photo(room_id=str(kitchen.id), tags=["after", "ceiling"])
    before_bath = await site.photo(room_id=str(bath.id), tags=["before"])
    loose = await site.photo(tags=["equipment"])

    assert await find(site, room_id=str(kitchen.id)) == [after_kitchen.id, before_kitchen.id]
    assert await find(site, unassigned=True) == [loose.id]
    assert await find(site, tag=["Before"]) == [before_bath.id, before_kitchen.id]
    assert await find(site, tag=["before", "ceiling"]) == [before_kitchen.id]
    assert await find(site, tag=["before"], room_id=str(bath.id)) == [before_bath.id]
    assert await find(site, tag=["missing"]) == []
    with pytest.raises(ValueError, match="not both"):
        PhotoListQuery.model_validate({"unassigned": True, "room_id": str(kitchen.id)})


async def test_tag_suggestions(site: Site) -> None:
    other_claim = Site(
        site.session,
        site.storage,
        site.organization_id,
        await open_claim(site.session, site.organization_id, site.user),
        site.user,
    )
    await site.photo(tags=["before", "ceiling"])
    await site.photo(tags=["before", "dryout"])
    await other_claim.photo(tags=["before", "cabinet", "dry_out"])

    async def suggest(prefix: str | None = None) -> list[tuple[str, int]]:
        found = await service.photo_tags(
            site.session, site.organization_id, user=site.user, prefix=prefix
        )
        return [(t.tag, t.photos) for t in found]

    assert await suggest() == [
        ("before", 3),
        ("cabinet", 1),
        ("ceiling", 1),
        ("dry_out", 1),
        ("dryout", 1),
    ]
    assert await suggest(" C ") == [("cabinet", 1), ("ceiling", 1)]
    # _ is a character here, not LIKE's any-one-character.
    assert await suggest("dry_") == [("dry_out", 1)]

    # Deleted claims and other organizations don't count.
    other_claim.claim.soft_delete()
    await site.session.commit()
    assert await suggest() == [("before", 2), ("ceiling", 1), ("dryout", 1)]
    theirs = await organizations.create_organization(
        site.session, OrganizationCreate(name="Theirs"), owner=site.user
    )
    assert await service.photo_tags(site.session, theirs.id, user=site.user) == []


async def test_access(site: Site) -> None:
    photo = await site.photo()
    viewer = await member(site, Role.VIEWER)

    assert await service.photo_tags(site.session, site.organization_id, user=viewer) == []
    with pytest.raises(PermissionDeniedError):
        await edit(site.by(viewer), photo, caption="Mine now")
    await claims.change_status(
        site.session,
        site.organization_id,
        site.claim.id,
        ClaimStatusChangeCreate.model_validate({"status": "cancelled", "reason": "Duplicate"}),
        user=site.user,
    )
    with pytest.raises(claims.ClaimLockedError):
        await edit(site, photo, caption="Too late")


async def test_at_most_20_tags(site: Site) -> None:
    photo = await site.photo()
    with pytest.raises(ValueError, match="20"):
        PhotoUpdate.model_validate({"tags": [f"t{i}" for i in range(21)]})

    photo.tags = [f"t{i}" for i in range(21)]
    with pytest.raises(IntegrityError, match="tags_limited"):
        await site.session.flush()
    await site.session.rollback()
