"""Price lists and their items.

Lists are audited; items aren't, row by row: an import can bring tens of thousands of
them, and estimates copy each line's price when it's added, so an estimate never changes
because a list did.
"""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from claimforge_api.db.base import Base
from claimforge_api.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin

#: Dollars and cents, up to ten billion.
Money = Numeric(12, 2)


class PriceList(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "price_lists"
    __audited__ = True

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    #: Published lists change monthly; this is the month or day the prices are from.
    effective_on: Mapped[date | None] = mapped_column(Date, default=None)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    #: When items last came in from a file: the audited record of an import.
    imported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    # Items go with their list, in the database (they aren't audited one by one).
    items: Mapped[list["PriceItem"]] = relationship(
        back_populates="price_list", passive_deletes=True, lazy="raise"
    )

    __table_args__ = (
        Index(
            "uq_price_lists_organization_id_name", "organization_id", func.lower(name), unique=True
        ),
        # At most one default per organization.
        Index(
            "uq_price_lists_default",
            "organization_id",
            unique=True,
            postgresql_where=text("is_default"),
        ),
        CheckConstraint("btrim(name) <> ''", name="name_not_blank"),
    )


class PriceItem(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "price_items"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    price_list_id: Mapped[UUID] = mapped_column(ForeignKey("price_lists.id", ondelete="CASCADE"))
    #: Unique in its list, ignoring case: "WTR DHM".
    code: Mapped[str] = mapped_column(String(40))
    description: Mapped[str] = mapped_column(String(500))
    #: EA, SF, LF, SY, HR, DA …
    unit: Mapped[str] = mapped_column(String(10))
    unit_price: Mapped[Decimal] = mapped_column(Money)
    #: For browsing: "WTR", "DRY".
    category: Mapped[str | None] = mapped_column(String(40), default=None)

    price_list: Mapped[PriceList] = relationship(back_populates="items", lazy="raise")

    __table_args__ = (
        Index("uq_price_items_price_list_id_code", "price_list_id", func.lower(code), unique=True),
        Index("ix_price_items_price_list_id_category", "price_list_id", "category"),
        CheckConstraint("unit_price >= 0", name="unit_price_not_negative"),
        CheckConstraint("btrim(code) <> ''", name="code_not_blank"),
        CheckConstraint("unit ~ '^[A-Z]{1,10}$'", name="unit_valid"),
    )
