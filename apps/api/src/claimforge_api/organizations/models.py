"""Organization: a tenant (restoration contractor, carrier or TPA)."""

from decimal import Decimal

from sqlalchemy import CheckConstraint, Index, Numeric, String, text
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
    #: What new estimates start with (percent, to a thousandth).
    default_tax_percent: Mapped[Decimal] = mapped_column(
        Numeric(6, 3), default=Decimal(0), server_default=text("0")
    )
    default_overhead_percent: Mapped[Decimal] = mapped_column(
        Numeric(6, 3), default=Decimal(0), server_default=text("0")
    )
    default_profit_percent: Mapped[Decimal] = mapped_column(
        Numeric(6, 3), default=Decimal(0), server_default=text("0")
    )

    __table_args__ = (
        CheckConstraint(f"slug ~ '{SLUG_PATTERN}'", name="slug_format"),
        *(
            CheckConstraint(
                f"default_{rate}_percent BETWEEN 0 AND 100", name=f"default_{rate}_valid"
            )
            for rate in ("tax", "overhead", "profit")
        ),
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
