"""Uploading claim photos straight to storage, and handing out links to them.

1. :func:`start_upload` records what the client will send and returns a signed link.
2. The client uploads the file to that link: the bytes never pass through the API.
3. :func:`complete_upload` checks the stored file against what was declared, and only then
   creates the :class:`Photo`.

Reading needs ``claims:read``; uploading and deleting need ``field_data:write`` and a claim
that is not closed or cancelled. Signed links can't limit size, so step 3 is what enforces
it: a file that doesn't match is deleted.
"""

import logging
from datetime import timedelta
from uuid import UUID

from sqlalchemy import Select, func, select, true
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from claimforge_api.auth.permissions import Permission, authorize
from claimforge_api.claims import service as claims
from claimforge_api.claims.models import Claim
from claimforge_api.claims.schemas import ClaimActor
from claimforge_api.core.errors import BusinessRuleError, NotFoundError
from claimforge_api.core.ids import uuid7
from claimforge_api.db.pagination import Page, SortKey, paginate
from claimforge_api.db.search import LIKE_ESCAPE, escape_like
from claimforge_api.photos.models import (
    Photo,
    PhotoProcessing,
    PhotoUpload,
    ProcessingStatus,
    Rendition,
    rendition_key,
    storage_key,
)
from claimforge_api.photos.schemas import (
    PhotoListQuery,
    PhotoRead,
    PhotoRoom,
    PhotoUpdate,
    PhotoUploadCreate,
    TagCount,
)
from claimforge_api.storage.base import ObjectStorage, SignedUpload, StorageUnavailableError
from claimforge_api.structures.models import Room
from claimforge_api.uploads.service import UPLOAD_LINK_LIFETIME, check_received
from claimforge_api.users.models import User

logger = logging.getLogger(__name__)

#: How long the links on a photo work. Clients fetch the photo again for fresh ones.
VIEW_LINK_LIFETIME = timedelta(hours=1)
NEWEST_FIRST = SortKey([Photo.id], direction="desc")  # UUIDv7: creation order


class PhotoTooLargeError(BusinessRuleError):
    code = "photo_too_large"
    title = "Photo too large"


class UnknownRoomError(BusinessRuleError):
    code = "unknown_room"
    title = "Unknown room"


async def _check_room(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, room_id: UUID | None
) -> None:
    if room_id is None:
        return
    found = await session.scalar(
        select(Room.id).where(
            Room.id == room_id, Room.claim_id == claim_id, Room.organization_id == organization_id
        )
    )
    if found is None:
        raise UnknownRoomError("No such room on this claim", room_id=str(room_id))


def _photos(organization_id: UUID, claim_id: UUID) -> Select[Photo]:
    return (
        select(Photo)
        .where(Photo.claim_id == claim_id, Photo.organization_id == organization_id)
        .options(
            selectinload(Photo.uploaded_by),
            selectinload(Photo.processing),
            selectinload(Photo.room),
        )
        # Fresh rows: the database unlinks rooms, and the worker updates processing.
        .execution_options(populate_existing=True)
    )


async def _find_photo(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, photo_id: UUID
) -> Photo | None:
    return await session.scalar(_photos(organization_id, claim_id).where(Photo.id == photo_id))


async def _get_photo(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, photo_id: UUID
) -> Photo:
    photo = await _find_photo(session, organization_id, claim_id, photo_id)
    if photo is None:
        raise NotFoundError("Photo not found", photo_id=str(photo_id))
    return photo


async def present(storage: ObjectStorage, photo: Photo) -> PhotoRead:
    """``photo`` as clients see it, with fresh links to the file and its renditions."""
    processing = photo.processing
    ready = processing.status == ProcessingStatus.READY

    async def link(rendition: Rendition) -> str | None:
        if not ready:
            return None
        key = rendition_key(photo.storage_key, rendition)
        return await storage.download_url(key, expires_in=VIEW_LINK_LIFETIME)

    return PhotoRead(
        id=photo.id,
        claim_id=photo.claim_id,
        filename=photo.original_filename,
        content_type=photo.content_type,
        size_bytes=photo.size_bytes,
        taken_at=photo.taken_at,
        caption=photo.caption,
        tags=photo.tags,
        room=PhotoRoom.model_validate(photo.room) if photo.room else None,
        uploaded_by=ClaimActor.model_validate(photo.uploaded_by) if photo.uploaded_by else None,
        created_at=photo.created_at,
        url=await storage.download_url(photo.storage_key, expires_in=VIEW_LINK_LIFETIME),
        download_url=await storage.download_url(
            photo.storage_key, expires_in=VIEW_LINK_LIFETIME, filename=photo.original_filename
        ),
        processing=processing.status,
        width=processing.width,
        height=processing.height,
        thumbnail_url=await link(Rendition.THUMBNAIL),
        preview_url=await link(Rendition.PREVIEW),
    )


async def list_photos(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    query: PhotoListQuery | None = None,
    *,
    user: User,
    limit: int,
    cursor: str | None,
) -> Page[Photo]:
    """A claim's photos, newest first. Unfinished uploads aren't photos yet."""
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    await claims.require_live(session, organization_id, claim_id)
    statement = _photos(organization_id, claim_id)
    if query is not None:
        if query.room_id is not None:
            statement = statement.where(Photo.room_id == query.room_id)
        if query.unassigned:
            statement = statement.where(Photo.room_id.is_(None))
        if query.tag:
            statement = statement.where(Photo.tags.contains(sorted(set(query.tag))))
    return await paginate(session, statement, NEWEST_FIRST, limit=limit, cursor=cursor)


async def get_photo(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, photo_id: UUID, *, user: User
) -> Photo:
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    await claims.require_live(session, organization_id, claim_id)
    return await _get_photo(session, organization_id, claim_id, photo_id)


async def start_upload(
    session: AsyncSession,
    storage: ObjectStorage,
    organization_id: UUID,
    claim_id: UUID,
    data: PhotoUploadCreate,
    *,
    user: User,
    max_bytes: int,
) -> tuple[PhotoUpload, SignedUpload]:
    """Record the upload ``data`` describes and sign a link for its file."""
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    if data.size_bytes > max_bytes:
        raise PhotoTooLargeError(
            f"Photos can be at most {max_bytes} bytes", limit=max_bytes, size=data.size_bytes
        )
    await _check_room(session, organization_id, claim_id, data.room_id)
    upload_id = uuid7()
    key = storage_key(organization_id, claim_id, upload_id)
    signed = await storage.upload_url(
        key, content_type=data.content_type, expires_in=UPLOAD_LINK_LIFETIME
    )
    upload = PhotoUpload(
        id=upload_id,
        organization_id=organization_id,
        claim_id=claim_id,
        storage_key=key,
        original_filename=data.filename,
        content_type=data.content_type,
        size_bytes=data.size_bytes,
        taken_at=data.taken_at,
        caption=data.caption,
        tags=data.tags,
        room_id=data.room_id,
        created_by_id=user.id,
        expires_at=signed.expires_at,
    )
    session.add(upload)
    await session.commit()
    return upload, signed


async def complete_upload(
    session: AsyncSession,
    storage: ObjectStorage,
    organization_id: UUID,
    claim_id: UUID,
    upload_id: UUID,
    *,
    user: User,
) -> tuple[Photo, bool]:
    """The photo for a finished upload, and whether this call created it.

    Completing again returns the same photo, so clients can retry safely.
    """
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    done = await _find_photo(session, organization_id, claim_id, upload_id)
    if done is not None:
        return done, False
    upload = await session.scalar(
        select(PhotoUpload)
        .where(
            PhotoUpload.id == upload_id,
            PhotoUpload.claim_id == claim_id,
            PhotoUpload.organization_id == organization_id,
        )
        # Fresh: if its room was deleted meanwhile, the database has unlinked it.
        .execution_options(populate_existing=True)
    )
    if upload is None:
        raise NotFoundError("Upload not found", upload_id=str(upload_id))

    # str(): a plain string once loaded from the database (the column is a String).
    await check_received(storage, upload, str(upload.content_type))

    session.add(
        Photo(
            id=upload.id,
            organization_id=organization_id,
            claim_id=claim_id,
            storage_key=upload.storage_key,
            original_filename=upload.original_filename,
            content_type=upload.content_type,
            size_bytes=upload.size_bytes,
            taken_at=upload.taken_at,
            caption=upload.caption,
            tags=list(upload.tags),
            room_id=upload.room_id,
            uploaded_by_id=upload.created_by_id,
            # Queued for the worker to make its renditions.
            processing=PhotoProcessing(),
        )
    )
    await session.delete(upload)
    await session.commit()
    return await _get_photo(session, organization_id, claim_id, upload_id), True


async def update_photo(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    photo_id: UUID,
    data: PhotoUpdate,
    *,
    user: User,
) -> Photo:
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    photo = await _get_photo(session, organization_id, claim_id, photo_id)
    changes = data.model_dump(exclude_unset=True)
    if changes.get("room_id") not in (None, photo.room_id):
        await _check_room(session, organization_id, claim_id, changes["room_id"])
    for field, value in changes.items():
        setattr(photo, field, value)
    # Unchanged values leave no history, so a no-op writes neither a row nor an audit event.
    await session.commit()
    return await _get_photo(session, organization_id, claim_id, photo_id)


async def photo_tags(
    session: AsyncSession,
    organization_id: UUID,
    *,
    user: User,
    prefix: str | None = None,
    limit: int = 20,
) -> list[TagCount]:
    """The tags on the organization's photos, most used first: suggestions while typing."""
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    # One row per photo and tag. A function in FROM may read the photo's own row.
    unnested = func.unnest(Photo.tags).table_valued("tag").render_derived(name="photo_tag")
    tag = unnested.c.tag
    statement = (
        select(tag, func.count().label("photos"))
        .select_from(Photo)
        .join(unnested, true())
        .join(Claim, Claim.id == Photo.claim_id)
        .where(Photo.organization_id == organization_id, Claim.not_deleted())
        .group_by(tag)
        .order_by(func.count().desc(), tag)
        .limit(limit)
    )
    typed = " ".join((prefix or "").split()).lower()  # as tags are stored
    if typed:
        statement = statement.where(tag.like(f"{escape_like(typed)}%", escape=LIKE_ESCAPE))
    rows = await session.execute(statement)
    return [TagCount(tag=name, photos=count) for name, count in rows]


async def delete_photo(
    session: AsyncSession,
    storage: ObjectStorage,
    organization_id: UUID,
    claim_id: UUID,
    photo_id: UUID,
    *,
    user: User,
) -> None:
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    photo = await _get_photo(session, organization_id, claim_id, photo_id)
    keys = [photo.storage_key, *photo.rendition_keys]
    await session.delete(photo)
    await session.commit()
    # After the commit: a file without a photo is only wasted space; a photo without its
    # file would be broken.
    try:
        for key in keys:
            await storage.delete(key)
    except StorageUnavailableError:
        logger.warning("Photo %s deleted but its files remain", photo_id, exc_info=True)
