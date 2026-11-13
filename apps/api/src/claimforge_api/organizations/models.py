"""Organization: a tenant (restoration contractor, carrier or TPA)."""

from sqlalchemy import CheckConstraint, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from claimforge_api.db.base import Base
from claimforge_api.db.mixins import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin

SLUG_PATTERN = r"^[a-z0-9]+(-[a-z0-9]+)*$"


class Organization(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "organizations"
    __audited__ = True

    name: Mapped[str] = mapped_column(String(200))
    # Used in URLs and as a human-friendly identifier: "rivera-restoration".
    slug: Mapped[str] = mapped_column(String(63))
    # IANA zone used for schedules, reading due dates and report timestamps.
    timezone: Mapped[str] = mapped_column(String(64), server_default="UTC")

    __table_args__ = (
        CheckConstraint(f"slug ~ '{SLUG_PATTERN}'", name="slug_format"),
        # Unique among live organizations, so a deleted org's slug can be reused.
        Index(
            "uq_organizations_slug_live",
            "slug",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    def __repr__(self) -> str:
        return f"<Organization {self.slug}>"
