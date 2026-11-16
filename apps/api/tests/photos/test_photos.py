"""Uploading claim photos: start, send the file, complete; then links, deletes and cleanup."""

from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import parse_qs, urlsplit

import pytest
from pydantic import ValidationError
from sqlalchemy import select
from tests.photos.conftest import (
    JPEG,
    MAX_BYTES,
    Site,
    count,
    describe,
    member,
    open_claim,
)

from claimforge_api.audit.models import AuditEvent
from claimforge_api.claims import service as claims
from claimforge_api.claims.schemas import ClaimStatusChangeCreate
from claimforge_api.core.errors import NotFoundError, PermissionDeniedError
from claimforge_api.photos import service
from claimforge_api.photos.models import Photo, PhotoUpload
from claimforge_api.storage.base import StorageUnavailableError
from claimforge_api.uploads import service as uploads
from claimforge_api.users import service as users
from claimforge_api.users.models import Role

# ─── The upload flow ──────────────────────────────────────────────────────────


async def test_start_send_complete(site: Site) -> None:
    taken = datetime(2026, 11, 14, 9, 30, tzinfo=UTC)
    upload, signed = await service.start_upload(
        site.session,
        site.storage,
        site.organization_id,
        site.claim.id,
        describe(taken_at=taken.isoformat()),
        user=site.user,
        max_bytes=MAX_BYTES,
    )
    assert upload.storage_key == (
        f"organizations/{site.organization_id}/claims/{site.claim.id}/photos/{upload.id}/original"
    )
    assert signed.headers == {"Content-Type": "image/jpeg"}
    assert upload.expires_at == signed.expires_at
    assert await site.photos() == []  # nothing to see until it's complete

    await site.send(upload)
    photo, created = await site.complete(upload.id)

    assert created
    assert photo.id == upload.id
    assert (photo.original_filename, photo.content_type, photo.size_bytes) == (
        "IMG_0412.jpg",
        "image/jpeg",
        len(JPEG),
    )
    assert photo.taken_at == taken
    assert photo.uploaded_by == site.user
    assert await count(site.session, PhotoUpload) == 0
    assert [p.id for p in await site.photos()] == [photo.id]


async def test_only_the_photo_reaches_the_history(site: Site) -> None:
    photo = await site.photo()

    events = list(
        await site.session.scalars(
            select(AuditEvent.action).where(AuditEvent.claim_id == site.claim.id)
        )
    )
    assert "photo.created" in events
    assert not [e for e in events if e.startswith("photo_upload")]
    created = await site.session.scalar(select(AuditEvent).where(AuditEvent.entity_id == photo.id))
    assert created is not None
    assert created.changes["original_filename"] == [None, "IMG_0412.jpg"]


async def test_completing_again_returns_the_same_photo(site: Site) -> None:
    upload = await site.start()
    await site.send(upload)
    first, _ = await site.complete(upload.id)

    again, created = await site.complete(upload.id)

    assert again.id == first.id
    assert not created
    assert await count(site.session, Photo) == 1


async def test_the_file_must_be_sent_first(site: Site) -> None:
    upload = await site.start()

    with pytest.raises(uploads.UploadNotReceivedError):
        await site.complete(upload.id)
    # Still open: send it and try again.
    await site.send(upload)
    photo, _ = await site.complete(upload.id)
    assert photo.id == upload.id


@pytest.mark.parametrize(
    ("data", "content_type", "received"),
    [
        (JPEG + b"and a little more", "image/jpeg", {"received_size": len(JPEG) + 17}),
        (JPEG, "image/png", {"received_content_type": "image/png"}),
    ],
)
async def test_the_file_must_match_what_was_described(
    site: Site, data: bytes, content_type: str, received: dict[str, Any]
) -> None:
    upload = await site.start()
    await site.send(upload, data, content_type)

    with pytest.raises(uploads.UploadMismatchError) as caught:
        await site.complete(upload.id)

    assert received.items() <= caught.value.extra.items()
    # The unchecked file is gone; the upload stays open for another try.
    assert await site.storage.stat(upload.storage_key) is None
    await site.send(upload)
    photo, _ = await site.complete(upload.id)
    assert photo.size_bytes == len(JPEG)


async def test_size_limit(site: Site) -> None:
    with pytest.raises(service.PhotoTooLargeError) as caught:
        await site.start(b"x" * (MAX_BYTES + 1))

    assert caught.value.extra == {"limit": MAX_BYTES, "size": MAX_BYTES + 1}
    assert await count(site.session, PhotoUpload) == 0


async def test_uploads_belong_to_their_claim(site: Site) -> None:
    upload = await site.start()
    await site.send(upload)
    other = Site(
        site.session,
        site.storage,
        site.organization_id,
        await open_claim(site.session, site.organization_id, site.user),
        site.user,
    )

    with pytest.raises(NotFoundError):
        await other.complete(upload.id)
    photo = await other.photo()
    assert [p.id for p in await site.photos()] == []
    assert [p.id for p in await other.photos()] == [photo.id]


def test_what_can_be_uploaded() -> None:
    assert describe(filename="  IMG_0412.jpg ").filename == "IMG_0412.jpg"
    assert describe(content_type="image/heic").content_type == "image/heic"
    invalid: list[dict[str, Any]] = [
        {"content_type": "image/gif"},
        {"content_type": "application/pdf"},
        {"size_bytes": 0},
        {"filename": "   "},
        {"filename": "x" * 256},
        {"taken_at": "2026-11-14T09:30:00"},  # no time zone
        {"room": "kitchen"},
    ]
    for fields in invalid:
        with pytest.raises(ValidationError):
            describe(**fields)


# ─── Reading ──────────────────────────────────────────────────────────────────


async def test_newest_first(site: Site) -> None:
    first = await site.photo(filename="first.jpg")
    second = await site.photo(filename="second.jpg")

    assert [p.id for p in await site.photos()] == [second.id, first.id]


async def test_photos_come_with_fresh_links(site: Site) -> None:
    photo = await site.photo(filename="Kitchen ceiling.jpg")

    shown = await service.present(site.storage, photo)

    assert shown.filename == "Kitchen ceiling.jpg"
    assert shown.uploaded_by is not None
    assert shown.uploaded_by.full_name == "Morgan Member"
    assert "filename" not in parse_qs(urlsplit(shown.url).query)
    assert parse_qs(urlsplit(shown.download_url).query)["filename"] == ["Kitchen ceiling.jpg"]
    for url in (shown.url, shown.download_url):
        expires = int(parse_qs(urlsplit(url).query)["expires"][0])
        assert expires - datetime.now(UTC).timestamp() == pytest.approx(3600, abs=5)


async def test_access(site: Site) -> None:
    photo = await site.photo()
    viewer = await member(site, Role.VIEWER)
    technician = await member(site, Role.TECHNICIAN)

    # Viewers see photos but can't add or remove them.
    assert [p.id for p in await site.by(viewer).photos()] == [photo.id]
    with pytest.raises(PermissionDeniedError):
        await site.by(viewer).start()
    with pytest.raises(PermissionDeniedError):
        await site.by(viewer).delete(photo)
    # Technicians document the site.
    await site.by(technician).photo()
    # Members of other organizations don't learn the claim exists.
    outsider = await users.create_user(site.session, email="out@example.com", full_name="Out")
    with pytest.raises(NotFoundError):
        await site.by(outsider).photos()


async def test_closed_claims_take_no_photos(site: Site) -> None:
    photo = await site.photo()
    upload = await site.start()
    await site.send(upload)
    await claims.change_status(
        site.session,
        site.organization_id,
        site.claim.id,
        ClaimStatusChangeCreate.model_validate({"status": "cancelled", "reason": "Duplicate"}),
        user=site.user,
    )

    with pytest.raises(claims.ClaimLockedError):
        await site.start()
    with pytest.raises(claims.ClaimLockedError):
        await site.complete(upload.id)
    with pytest.raises(claims.ClaimLockedError):
        await site.delete(photo)
    assert [p.id for p in await site.photos()] == [photo.id]


# ─── Deleting and cleaning up ─────────────────────────────────────────────────


async def test_deleting_removes_the_file(site: Site) -> None:
    photo = await site.photo()
    key = photo.storage_key

    await site.delete(photo)

    assert await site.photos() == []
    assert await site.storage.stat(key) is None
    deleted = await site.session.scalar(
        select(AuditEvent).where(
            AuditEvent.entity_id == photo.id, AuditEvent.action == "photo.deleted"
        )
    )
    assert deleted is not None


class UnreachableDeletes:
    """Storage whose deletes fail (and that is all these tests ask of it)."""

    async def delete(self, key: str) -> None:
        raise StorageUnavailableError("storage is down")


async def test_a_photo_can_be_deleted_while_storage_is_down(
    site: Site, caplog: pytest.LogCaptureFixture
) -> None:
    photo = await site.photo()

    await site.delete(photo, UnreachableDeletes())  # type: ignore[arg-type]

    assert await site.photos() == []
    assert "files remain" in caplog.text


async def test_abandoned_uploads_are_discarded(site: Site) -> None:
    sent = await site.start()
    await site.send(sent)
    never_sent = await site.start()
    recent = await site.start()
    later = datetime.now(UTC) + uploads.UPLOAD_LINK_LIFETIME + uploads.UPLOAD_GRACE

    # Down for one call: the uploads are kept for the next.
    assert (
        await uploads.discard_expired(
            site.session,
            UnreachableDeletes(),  # type: ignore[arg-type]
            PhotoUpload,
            now=later + timedelta(minutes=1),
        )
        == 0
    )
    assert await count(site.session, PhotoUpload) == 3

    # Only uploads whose link expired more than the grace period ago go.
    recent.expires_at = later + timedelta(hours=1)
    await site.session.commit()
    discarded = await uploads.discard_expired(
        site.session, site.storage, PhotoUpload, now=later + timedelta(minutes=1)
    )

    assert discarded == 2
    assert await site.storage.stat(sent.storage_key) is None
    remaining = list(await site.session.scalars(select(PhotoUpload.id)))
    assert remaining == [recent.id]
    assert never_sent.id not in remaining
