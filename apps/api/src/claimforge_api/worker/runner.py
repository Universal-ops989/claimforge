"""The worker loop: drain the photo queue, clean up now and then, wait for more.

Any number of workers can run at once: photos are taken with ``SKIP LOCKED``, and two
cleanups at the same time just find less to do. A worker asked to stop finishes the photo
in hand first, so nothing is left half-written.
"""

import asyncio
import contextlib
import logging
import time
from collections.abc import Awaitable, Callable
from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass, field
from uuid import UUID

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.documents.models import DocumentUpload
from claimforge_api.photos import processing
from claimforge_api.photos.models import PhotoUpload
from claimforge_api.reports import jobs
from claimforge_api.storage.base import ObjectStorage, StorageUnavailableError
from claimforge_api.uploads import service as uploads
from claimforge_api.uploads.models import PendingUpload

logger = logging.getLogger(__name__)

SessionFactory = Callable[[], AbstractAsyncContextManager[AsyncSession]]

#: The queues a worker takes work from: each takes one item and says which, or None.
QUEUES: tuple[Callable[[AsyncSession, ObjectStorage], Awaitable[UUID | None]], ...] = (
    processing.process_next,
    jobs.process_next,
)

#: Every kind of pending upload the cleanup looks after.
PENDING_UPLOADS: tuple[type[PendingUpload], ...] = (PhotoUpload, DocumentUpload)


@dataclass
class Worker:
    sessions: SessionFactory
    storage: ObjectStorage
    #: Seconds an idle worker waits before looking again (and after a database error).
    poll_interval: float = 5.0
    #: Seconds between discarding abandoned uploads.
    cleanup_interval: float = 15 * 60
    clock: Callable[[], float] = time.monotonic
    _last_cleanup: float | None = field(default=None, init=False)

    async def drain(self, stop: asyncio.Event | None = None) -> int:
        """Work the queues until nothing is due (or ``stop`` is set). How many items were done.

        Each round takes one item from every queue in turn, so a burst of photos doesn't
        hold reports up, nor the reverse.
        """
        processed = 0
        while stop is None or not stop.is_set():
            worked = False
            for task in QUEUES:
                async with self.sessions() as session:
                    if await task(session, self.storage) is not None:
                        processed += 1
                        worked = True
                if stop is not None and stop.is_set():
                    break
            if not worked:
                return processed
        return processed

    async def clean_up(self, *, force: bool = False) -> int:
        """Discard abandoned uploads, if it's time (or ``force``). How many were discarded."""
        now = self.clock()
        last = self._last_cleanup
        if not force and last is not None and now - last < self.cleanup_interval:
            return 0
        self._last_cleanup = now
        discarded = 0
        for model in PENDING_UPLOADS:
            while True:
                async with self.sessions() as session:
                    batch = await uploads.discard_expired(session, self.storage, model)
                discarded += batch
                if batch < uploads.DISCARD_BATCH:
                    break
        if discarded:
            logger.info("Discarded %d abandoned uploads", discarded)
        return discarded

    async def run_once(self) -> tuple[int, int]:
        """Everything that is due now: (photos processed, uploads discarded)."""
        return await self.drain(), await self.clean_up(force=True)

    async def run(self, stop: asyncio.Event) -> None:
        """Work until ``stop`` is set. Outages are logged and waited out, never fatal."""
        logger.info("Worker started")
        while not stop.is_set():
            try:
                processed = await self.drain(stop)
                if processed:
                    logger.info("Processed %d photos", processed)
                await self.clean_up()
            except (SQLAlchemyError, OSError, StorageUnavailableError):
                logger.exception("Worker iteration failed; retrying in %ss", self.poll_interval)
            # Sleep, but wake as soon as we're asked to stop.
            with contextlib.suppress(TimeoutError):
                await asyncio.wait_for(stop.wait(), timeout=self.poll_interval)
        logger.info("Worker stopped")
