"""Photos, and the uploads that become them.

An upload is a promise: the client was given a signed link to put a file at
``storage_key``. Only when it reports back, and the stored file matches what it declared,
does a :class:`Photo` with the same id exist. Uploads aren't audited, so a claim's history
only ever shows photos people can see.
"""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from claimforge_api.db.base import Base
from claimforge_api.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin
from claimforge_api.structures.models import Room
from claimforge_api.uploads.models import ClaimFile, PendingUpload
from claimforge_api.users.models import User


class PhotoType(StrEnum):
    """Image formats phones and cameras produce, which browsers or the thumbnailer read."""

    JPEG = "image/jpeg"
    PNG = "image/png"
    WEBP = "image/webp"
    HEIC = "image/heic"  # iPhones, by default
    HEIF = "image/heif"


_PHOTO_TYPES = ", ".join(sorted(repr(t.value) for t in PhotoType))


class Rendition(StrEnum):
    """The JPEG versions made of every photo; the value is the file's name."""

    THUMBNAIL = "thumbnail.jpg"
    PREVIEW = "preview.jpg"


class ProcessingStatus(StrEnum):
    PENDING = "pending"
    READY = "ready"
    FAILED = "failed"  # unreadable, or storage kept failing: only the original is there


def storage_key(organization_id: UUID, claim_id: UUID, photo_id: UUID) -> str:
    """Where a photo's original file lives. Ids only: nothing a user typed."""
    return f"organizations/{organization_id}/claims/{claim_id}/photos/{photo_id}/original"


def rendition_key(original_key: str, rendition: Rendition) -> str:
    """A rendition's key, beside the original's."""
    folder, _, _ = original_key.rpartition("/")
    return f"{folder}/{rendition.value}"


class _PhotoFile(ClaimFile):
    """What is known about a photo before and after it is uploaded."""

    content_type: Mapped[PhotoType] = mapped_column(String(20))
    #: When the picture was taken, as the device reports it (EXIF); not checked.
    taken_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    caption: Mapped[str | None] = mapped_column(Text, default=None)
    #: Normalized by the schemas: trimmed, lowercase, unique, sorted.
    tags: Mapped[list[str]] = mapped_column(ARRAY(String(40)), default=list, server_default="{}")
    room_id: Mapped[UUID | None] = mapped_column(default=None)


def _in_its_claims_room() -> ForeignKeyConstraint:
    """Through (claim_id, room_id) only a room of the same claim; deleting it unlinks."""
    return ForeignKeyConstraint(
        ["claim_id", "room_id"], ["rooms.claim_id", "rooms.id"], ondelete="SET NULL (room_id)"
    )


_AT_MOST_20_TAGS = "cardinality(tags) <= 20"


class PhotoUpload(_PhotoFile, PendingUpload, TimestampMixin, Base):
    __tablename__ = "photo_uploads"

    __table_args__ = (
        CheckConstraint(f"content_type IN ({_PHOTO_TYPES})", name="content_type_valid"),
        CheckConstraint("size_bytes > 0", name="size_positive"),
        CheckConstraint(_AT_MOST_20_TAGS, name="tags_limited"),
        _in_its_claims_room(),
        Index("ix_photo_uploads_claim_id", "claim_id"),
        # Finding abandoned uploads to discard.
        Index("ix_photo_uploads_expires_at", "expires_at"),
    )


class Photo(_PhotoFile, UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "photos"
    __audited__ = True

    uploaded_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )

    uploaded_by: Mapped[User | None] = relationship(lazy="raise")
    # Read-only: room_id is set directly, and claim_id belongs to the claim.
    room: Mapped[Room | None] = relationship(lazy="raise", viewonly=True)
    # The database deletes it with the photo (passive_deletes): no extra load on delete.
    processing: Mapped["PhotoProcessing"] = relationship(
        lazy="raise", cascade="all, delete-orphan", passive_deletes=True
    )

    @property
    def rendition_keys(self) -> list[str]:
        return [rendition_key(self.storage_key, r) for r in Rendition]

    __table_args__ = (
        CheckConstraint(f"content_type IN ({_PHOTO_TYPES})", name="content_type_valid"),
        CheckConstraint("size_bytes > 0", name="size_positive"),
        CheckConstraint(_AT_MOST_20_TAGS, name="tags_limited"),
        _in_its_claims_room(),
        # A claim's photos, newest first (ids are time-ordered).
        Index("ix_photos_claim_id_id", "claim_id", "id"),
        # A room's photos, and unlinking them when it's deleted.
        Index("ix_photos_claim_id_room_id", "claim_id", "room_id"),
        # Filtering by tag (tags @> ...) and the organization's tag list.
        Index("ix_photos_tags", "tags", postgresql_using="gin"),
    )


class PhotoProcessing(TimestampMixin, Base):
    """Making a photo's renditions: a queue the worker takes photos from.

    Its own table so the worker's bookkeeping never reaches the audit log: photos are
    audited, this isn't.
    """

    __tablename__ = "photo_processing"

    photo_id: Mapped[UUID] = mapped_column(
        ForeignKey("photos.id", ondelete="CASCADE"), primary_key=True
    )
    status: Mapped[ProcessingStatus] = mapped_column(
        String(20), default=ProcessingStatus.PENDING, server_default=ProcessingStatus.PENDING
    )
    attempts: Mapped[int] = mapped_column(SmallInteger, default=0, server_default="0")
    #: Pending photos wait until then (backing off while storage is down).
    next_attempt_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    #: Of the original, upright.
    width: Mapped[int | None] = mapped_column(Integer, default=None)
    height: Mapped[int | None] = mapped_column(Integer, default=None)
    error: Mapped[str | None] = mapped_column(String(500), default=None)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    __table_args__ = (
        CheckConstraint("status IN ('failed', 'pending', 'ready')", name="status_valid"),
        CheckConstraint(
            "(status = 'ready') = (width IS NOT NULL AND height IS NOT NULL)",
            name="ready_has_dimensions",
        ),
        # The worker's queue: pending photos, soonest first.
        Index(
            "ix_photo_processing_queue",
            "next_attempt_at",
            postgresql_where=text("status = 'pending'"),
        ),
    )
