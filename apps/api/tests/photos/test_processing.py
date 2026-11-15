"""The processing queue: photos become ready, fail, or wait for storage to come back."""

import importlib.util
import io
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import ModuleType
from uuid import UUID

import pytest
from PIL import Image
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from tests.photos.conftest import Site

from claimforge_api.photos import processing, service
from claimforge_api.photos.models import Photo, PhotoProcessing, ProcessingStatus, Rendition
from claimforge_api.storage.base import ObjectInfo, StorageUnavailableError
from claimforge_api.storage.local import LocalStorage

MIGRATION = next(
    (Path(__file__).parents[2] / "migrations" / "versions").glob("*_1463402b5b0f_*.py")
)


def jpeg(size: tuple[int, int] = (2400, 1800)) -> bytes:
    out = io.BytesIO()
    Image.new("RGB", size, "teal").save(out, format="JPEG")
    return out.getvalue()


async def job(session: AsyncSession, photo_id: UUID) -> PhotoProcessing:
    found = await session.scalar(
        select(PhotoProcessing)
        .where(PhotoProcessing.photo_id == photo_id)
        .execution_options(populate_existing=True)
    )
    assert found is not None
    return found


async def test_a_photo_becomes_ready(site: Site) -> None:
    photo = await site.photo(jpeg())
    shown = await service.present(site.storage, photo)
    assert (shown.processing, shown.thumbnail_url, shown.preview_url) == ("pending", None, None)

    assert await processing.process_next(site.session, site.storage) == photo.id
    assert await processing.process_next(site.session, site.storage) is None  # queue empty

    done = await job(site.session, photo.id)
    assert (done.status, done.width, done.height, done.attempts) == ("ready", 2400, 1800, 1)
    for rendition in Rendition:
        stored = await site.storage.stat(photo.storage_key.replace("original", rendition.value))
        assert stored is not None
        assert stored.content_type == "image/jpeg"
    [listed] = await site.photos()
    shown = await service.present(site.storage, listed)
    assert (shown.processing, shown.width, shown.height) == ("ready", 2400, 1800)
    assert shown.thumbnail_url is not None
    assert "thumbnail.jpg" in shown.thumbnail_url
    assert shown.preview_url is not None
    assert "preview.jpg" in shown.preview_url


async def test_processing_stays_out_of_the_history(site: Site) -> None:
    photo = await site.photo(jpeg())
    await processing.process_next(site.session, site.storage)

    actions = list(
        await site.session.scalars(
            text("SELECT action FROM audit_events WHERE entity_id = :id").bindparams(id=photo.id)
        )
    )
    assert actions == ["photo.created"]


async def test_unreadable_photos_fail_but_stay(site: Site) -> None:
    # Declared and stored as a JPEG; not one.
    photo = await site.photo(b"\xff\xd8 not really a jpeg")

    await processing.process_next(site.session, site.storage)

    failed = await job(site.session, photo.id)
    assert failed.status == ProcessingStatus.FAILED
    assert failed.error is not None
    assert failed.error.startswith("Not a readable image")
    [listed] = await site.photos()
    shown = await service.present(site.storage, listed)
    assert (shown.processing, shown.thumbnail_url, shown.width) == ("failed", None, None)
    assert await site.storage.get(photo.storage_key)  # the original can still be downloaded


async def test_a_missing_original_fails(site: Site) -> None:
    photo = await site.photo(jpeg())
    await site.storage.delete(photo.storage_key)

    await processing.process_next(site.session, site.storage)

    failed = await job(site.session, photo.id)
    assert (failed.status, failed.error) == ("failed", "The original file is missing")


class Flaky:
    """Storage whose reads fail while ``down`` is set."""

    def __init__(self, storage: LocalStorage) -> None:
        self.storage, self.down = storage, True

    async def get(self, key: str) -> bytes:
        if self.down:
            raise StorageUnavailableError("connection refused")
        return await self.storage.get(key)

    async def put(self, key: str, data: bytes, *, content_type: str) -> ObjectInfo:
        return await self.storage.put(key, data, content_type=content_type)


async def test_storage_outages_back_off_then_give_up(site: Site) -> None:
    photo = await site.photo(jpeg())
    flaky = Flaky(site.storage)
    now = datetime.now(UTC)

    assert await processing.process_next(site.session, flaky, now=now) == photo.id  # type: ignore[arg-type]
    waiting = await job(site.session, photo.id)
    assert (waiting.status, waiting.attempts, waiting.error) == (
        "pending",
        1,
        "connection refused",
    )
    assert waiting.next_attempt_at == now + timedelta(minutes=2)
    # Not due yet: nothing to do.
    assert await processing.process_next(site.session, flaky, now=now) is None  # type: ignore[arg-type]

    # Storage is back by the next try.
    flaky.down = False
    later = now + timedelta(minutes=3)
    assert await processing.process_next(site.session, flaky, now=later) == photo.id  # type: ignore[arg-type]
    done = await job(site.session, photo.id)
    assert (done.status, done.attempts, done.error) == ("ready", 2, None)

    # Another photo, and storage never comes back.
    other = await site.photo(jpeg())
    flaky.down = True
    moment = now
    for _ in range(processing.MAX_ATTEMPTS):
        moment += processing.MAX_BACKOFF
        await processing.process_next(site.session, flaky, now=moment)  # type: ignore[arg-type]
    given_up = await job(site.session, other.id)
    assert (given_up.status, given_up.attempts) == ("failed", processing.MAX_ATTEMPTS)
    assert given_up.error == "Storage unavailable: connection refused"


def test_backoff() -> None:
    assert [processing.backoff(n).total_seconds() / 60 for n in range(1, 8)] == [
        2,
        4,
        8,
        16,
        32,
        60,
        60,
    ]


async def test_deleting_removes_the_renditions(site: Site) -> None:
    photo = await site.photo(jpeg())
    await processing.process_next(site.session, site.storage)
    keys = [photo.storage_key, *photo.rendition_keys]

    await site.delete(photo)

    assert [await site.storage.stat(key) for key in keys] == [None, None, None]
    assert await site.session.get(PhotoProcessing, photo.id) is None


def load_migration() -> ModuleType:
    spec = importlib.util.spec_from_file_location("photo_processing_migration", MIGRATION)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def backfill() -> str:
    statement: str = load_migration().BACKFILL
    return statement


async def test_the_migration_queues_existing_photos(site: Site, backfill: str) -> None:
    photo_id = (await site.photo(jpeg())).id
    # As before this change: photos, and no processing rows.
    await site.session.execute(delete(PhotoProcessing))

    await site.session.execute(text(backfill))
    await site.session.execute(text(backfill))  # again: nothing more

    queued = list(await site.session.scalars(select(PhotoProcessing)))
    assert [(q.photo_id, q.status, q.attempts) for q in queued] == [(photo_id, "pending", 0)]
    created_at = await site.session.scalar(select(Photo.created_at).where(Photo.id == photo_id))
    assert queued[0].next_attempt_at == created_at
