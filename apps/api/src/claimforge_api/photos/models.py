"""Photos, and the uploads that become them.

An upload is a promise: the client was given a signed link to put a file at
``storage_key``. Only when it reports back, and the stored file matches what it declared,
does a :class:`Photo` with the same id exist. Uploads aren't audited, so a claim's history
only ever shows photos people can see.
"""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from claimforge_api.db.base import Base
from claimforge_api.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin
from claimforge_api.users.models import User


class PhotoType(StrEnum):
    """Image formats phones and cameras produce, which browsers or the thumbnailer read."""

    JPEG = "image/jpeg"
    PNG = "image/png"
    WEBP = "image/webp"
    HEIC = "image/heic"  # iPhones, by default
    HEIF = "image/heif"


_PHOTO_TYPES = ", ".join(sorted(repr(t.value) for t in PhotoType))


def storage_key(organization_id: UUID, claim_id: UUID, photo_id: UUID) -> str:
    """Where a photo's original file lives. Ids only: nothing a user typed."""
    return f"organizations/{organization_id}/claims/{claim_id}/photos/{photo_id}/original"


class _File:
    """What is known about a file before and after it is uploaded."""

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    claim_id: Mapped[UUID] = mapped_column(ForeignKey("claims.id", ondelete="CASCADE"))
    storage_key: Mapped[str] = mapped_column(String(512), unique=True)
    original_filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[PhotoType] = mapped_column(String(20))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    #: When the picture was taken, as the device reports it (EXIF); not checked.
    taken_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class PhotoUpload(_File, UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "photo_uploads"

    created_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )
    #: When the signed upload link stops working.
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint(f"content_type IN ({_PHOTO_TYPES})", name="content_type_valid"),
        CheckConstraint("size_bytes > 0", name="size_positive"),
        Index("ix_photo_uploads_claim_id", "claim_id"),
        # Finding abandoned uploads to discard.
        Index("ix_photo_uploads_expires_at", "expires_at"),
    )


class Photo(_File, UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "photos"
    __audited__ = True

    uploaded_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )

    uploaded_by: Mapped[User | None] = relationship(lazy="raise")

    __table_args__ = (
        CheckConstraint(f"content_type IN ({_PHOTO_TYPES})", name="content_type_valid"),
        CheckConstraint("size_bytes > 0", name="size_positive"),
        # A claim's photos, newest first (ids are time-ordered).
        Index("ix_photos_claim_id_id", "claim_id", "id"),
    )
