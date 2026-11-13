"""Column conventions shared by ORM models."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import ColumnElement, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from claimforge_api.core.ids import uuid7


class UUIDPrimaryKeyMixin:
    """``id``: time-ordered UUIDv7 primary key, generated in Python."""

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid7, sort_order=-100)


class TimestampMixin:
    """``created_at`` / ``updated_at`` as ``timestamptz`` maintained by the database."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        sort_order=90,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        sort_order=91,
    )


class SoftDeleteMixin:
    """``deleted_at``: rows are hidden instead of removed, so history and audits survive."""

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        default=None,
        sort_order=92,
    )

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    def soft_delete(self, at: datetime | None = None) -> None:
        self.deleted_at = at or datetime.now(UTC)

    def restore(self) -> None:
        self.deleted_at = None

    @classmethod
    def not_deleted(cls) -> ColumnElement[bool]:
        """Filter for live rows: ``select(Claim).where(Claim.not_deleted())``."""
        return cls.deleted_at.is_(None)
