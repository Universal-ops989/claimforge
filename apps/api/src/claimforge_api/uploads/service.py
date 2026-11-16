"""Checking uploads that arrived, and forgetting the ones that never will."""

import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.core.errors import BusinessRuleError, ConflictError
from claimforge_api.storage.base import ObjectStorage, StorageUnavailableError
from claimforge_api.uploads.models import PendingUpload

logger = logging.getLogger(__name__)

#: How long a client has to send the file once it asks to.
UPLOAD_LINK_LIFETIME = timedelta(minutes=30)
#: How long an unfinished upload is kept after its link expires: a client on a slow
#: connection may have sent the file just in time and still be reporting back.
UPLOAD_GRACE = timedelta(hours=1)
#: Abandoned uploads discarded per call of :func:`discard_expired`.
DISCARD_BATCH = 100


class UploadNotReceivedError(ConflictError):
    code = "upload_not_received"
    title = "The file hasn't been uploaded yet"


class UploadMismatchError(BusinessRuleError):
    code = "upload_mismatch"
    title = "The uploaded file isn't the one described"


async def check_received(storage: ObjectStorage, upload: PendingUpload, content_type: str) -> None:
    """Return if the stored file is the one ``upload`` described, else say why not.

    Signed links can't limit size, so this is what enforces it. A file that doesn't match
    is deleted, so a retry with the same link starts clean (and nothing unchecked stays).
    """
    stored = await storage.stat(upload.storage_key)
    if stored is None:
        raise UploadNotReceivedError(
            "Upload the file to the link first, then complete the upload",
            upload_id=str(upload.id),
        )
    if stored.size != upload.size_bytes or stored.content_type != content_type:
        await storage.delete(upload.storage_key)
        raise UploadMismatchError(
            f"Expected {upload.size_bytes} bytes of {content_type}, "
            f"received {stored.size} bytes of {stored.content_type}",
            expected_size=upload.size_bytes,
            received_size=stored.size,
            expected_content_type=content_type,
            received_content_type=stored.content_type,
        )


async def discard_expired(
    session: AsyncSession,
    storage: ObjectStorage,
    model: type[PendingUpload],
    *,
    now: datetime | None = None,
) -> int:
    """Forget uploads of ``model`` nobody completed, deleting any file that was sent.

    Handles up to :data:`DISCARD_BATCH` per call; run it periodically. An upload whose
    file can't be deleted (storage down) is kept and tried again next time. Returns how
    many were discarded.
    """
    cutoff = (now or datetime.now(UTC)) - UPLOAD_GRACE
    abandoned = list(
        await session.execute(
            select(model.id, model.storage_key)
            .where(model.expires_at < cutoff)
            .order_by(model.expires_at)
            .limit(DISCARD_BATCH)
        )
    )
    discarded: list[UUID] = []
    for upload_id, key in abandoned:
        try:
            await storage.delete(key)
        except StorageUnavailableError:
            logger.warning("Couldn't delete abandoned upload %s", key, exc_info=True)
            continue
        discarded.append(upload_id)
    if discarded:
        await session.execute(delete(model).where(model.id.in_(discarded)))
        await session.commit()
    return len(discarded)
