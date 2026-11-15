"""Making photos' renditions, one queued photo at a time.

:func:`process_next` takes the next pending photo with ``FOR UPDATE SKIP LOCKED``, so any
number of workers can share the queue without taking the same photo twice. The row stays
locked until its outcome is committed:

- **ready**: both renditions stored, dimensions recorded.
- **failed**: the file isn't a readable image, or the original is gone. Final: people still
  have the original, just no thumbnails.
- **pending again**: storage was unavailable. It waits longer after each try, and fails
  after :data:`MAX_ATTEMPTS`.
"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.photos.models import (
    Photo,
    PhotoProcessing,
    ProcessingStatus,
    Rendition,
    rendition_key,
)
from claimforge_api.photos.renditions import UnreadableImageError, render
from claimforge_api.storage.base import (
    ObjectNotFoundError,
    ObjectStorage,
    StorageUnavailableError,
)

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 5
MAX_BACKOFF = timedelta(hours=1)
_ERROR_LENGTH = 500


def backoff(attempts: int) -> timedelta:
    """How long to wait after ``attempts`` failed tries: 2, 4, 8 … minutes, at most an hour."""
    return min(timedelta(minutes=2**attempts), MAX_BACKOFF)


def _fail(job: PhotoProcessing, error: str, now: datetime) -> None:
    job.status = ProcessingStatus.FAILED
    job.error = error[:_ERROR_LENGTH]
    job.processed_at = now


async def process_next(
    session: AsyncSession, storage: ObjectStorage, *, now: datetime | None = None
) -> UUID | None:
    """Process the next photo that is due. Its id, or ``None`` when none is waiting."""
    now = now or datetime.now(UTC)
    job = await session.scalar(
        select(PhotoProcessing)
        .where(
            PhotoProcessing.status == ProcessingStatus.PENDING,
            PhotoProcessing.next_attempt_at <= now,
        )
        .order_by(PhotoProcessing.next_attempt_at, PhotoProcessing.photo_id)
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    if job is None:
        return None
    photo_id = job.photo_id
    key = (
        await session.execute(select(Photo.storage_key).where(Photo.id == photo_id))
    ).scalar_one()
    job.attempts += 1
    try:
        original = await storage.get(key)
        made = await asyncio.to_thread(render, original)
        for rendition, data in (
            (Rendition.THUMBNAIL, made.thumbnail),
            (Rendition.PREVIEW, made.preview),
        ):
            await storage.put(rendition_key(key, rendition), data, content_type="image/jpeg")
    except UnreadableImageError as error:
        logger.info("Photo %s can't be read: %s", photo_id, error)
        _fail(job, str(error), now)
    except ObjectNotFoundError:
        logger.warning("Photo %s has no original file at %s", photo_id, key)
        _fail(job, "The original file is missing", now)
    except StorageUnavailableError as error:
        if job.attempts >= MAX_ATTEMPTS:
            logger.error("Giving up on photo %s after %d tries: %s", photo_id, job.attempts, error)
            _fail(job, f"Storage unavailable: {error}", now)
        else:
            logger.warning("Photo %s will be retried: %s", photo_id, error)
            job.error = str(error)[:_ERROR_LENGTH]
            job.next_attempt_at = now + backoff(job.attempts)
    except Exception as error:
        # A file the image libraries choke on in a way render() doesn't expect. Retrying
        # would hit the same wall forever, so this photo fails and the queue moves on.
        logger.exception("Couldn't process photo %s", photo_id)
        _fail(job, f"Couldn't process this file ({type(error).__name__})", now)
    else:
        job.status = ProcessingStatus.READY
        job.width, job.height = made.width, made.height
        job.error = None
        job.processed_at = now
    await session.commit()
    return photo_id
