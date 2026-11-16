"""Columns shared by claim files and by the pending uploads that become them."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import BigInteger, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from claimforge_api.db.mixins import UUIDPrimaryKeyMixin


class ClaimFile:
    """A file of a claim's, in storage under ``storage_key`` (built from ids only)."""

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    claim_id: Mapped[UUID] = mapped_column(ForeignKey("claims.id", ondelete="CASCADE"))
    storage_key: Mapped[str] = mapped_column(String(512), unique=True)
    original_filename: Mapped[str] = mapped_column(String(255))
    size_bytes: Mapped[int] = mapped_column(BigInteger)


class PendingUpload(UUIDPrimaryKeyMixin, ClaimFile):
    """A file a client was given a link to send. Not audited: it isn't anything yet.

    Concrete tables add a ``content_type`` column (each kind allows its own types) and an
    index on ``expires_at`` for :func:`claimforge_api.uploads.service.discard_expired`.
    """

    created_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )
    #: When the signed upload link stops working.
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
