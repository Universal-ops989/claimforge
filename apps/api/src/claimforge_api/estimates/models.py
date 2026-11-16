"""Estimates and their lines.

A line keeps its own code, description, unit and unit price, copied from the price list
when it's added (or written by hand), so an estimate never changes because a list did.
"""

from decimal import ROUND_HALF_UP, Decimal
from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from claimforge_api.db.base import Base
from claimforge_api.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin
from claimforge_api.pricing.models import Money, PriceList
from claimforge_api.structures.models import Room
from claimforge_api.users.models import User

#: Quantities to a hundredth: 125.5 SF, 3 DA, 0.25 HR.
Quantity = Numeric(12, 2)
CENT = Decimal("0.01")


class EstimateStatus(StrEnum):
    DRAFT = "draft"  # the only state lines can change in
    SUBMITTED = "submitted"  # sent to the carrier
    APPROVED = "approved"
    REJECTED = "rejected"


def _in(column: str, values: type[StrEnum]) -> str:
    return f"{column} IN ({', '.join(sorted(repr(v.value) for v in values))})"


class Estimate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "estimates"
    __audited__ = True

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    claim_id: Mapped[UUID] = mapped_column(ForeignKey("claims.id", ondelete="CASCADE"))
    #: 1, 2 … on the claim.
    number: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(200))
    status: Mapped[EstimateStatus] = mapped_column(String(20), default=EstimateStatus.DRAFT)
    #: Where new lines are priced from. Lines keep their own copy of each price.
    price_list_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("price_lists.id", ondelete="SET NULL"), default=None
    )
    notes: Mapped[str | None] = mapped_column(Text, default=None)
    created_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )

    price_list: Mapped[PriceList | None] = relationship(lazy="raise")
    created_by: Mapped[User | None] = relationship(lazy="raise")
    # Loaded when the estimate is deleted, so each line's removal is audited.
    lines: Mapped[list["EstimateLine"]] = relationship(
        back_populates="estimate",
        cascade="all, delete-orphan",
        lazy="raise",
        order_by="EstimateLine.position",
    )

    __table_args__ = (
        UniqueConstraint("claim_id", "number"),
        # Lines point at (claim_id, id), so they can only be of their own claim's estimates.
        UniqueConstraint("claim_id", "id"),
        CheckConstraint(_in("status", EstimateStatus), name="status_valid"),
        CheckConstraint("number > 0", name="number_positive"),
        CheckConstraint("btrim(title) <> ''", name="title_not_blank"),
    )


class EstimateLine(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "estimate_lines"
    __audited__ = True

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    claim_id: Mapped[UUID] = mapped_column(ForeignKey("claims.id", ondelete="CASCADE"))
    estimate_id: Mapped[UUID]
    #: Where it goes in the estimate, from 1.
    position: Mapped[int] = mapped_column(Integer)
    room_id: Mapped[UUID | None] = mapped_column(default=None)
    #: The price item it came from, if any; its values are copied, not followed.
    price_item_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("price_items.id", ondelete="SET NULL"), default=None
    )
    code: Mapped[str | None] = mapped_column(String(40), default=None)
    description: Mapped[str] = mapped_column(String(500))
    unit: Mapped[str] = mapped_column(String(10))
    quantity: Mapped[Decimal] = mapped_column(Quantity)
    unit_price: Mapped[Decimal] = mapped_column(Money)
    notes: Mapped[str | None] = mapped_column(Text, default=None)

    estimate: Mapped[Estimate] = relationship(back_populates="lines", lazy="raise")
    room: Mapped[Room | None] = relationship(lazy="raise", viewonly=True)

    @property
    def total(self) -> Decimal:
        """Quantity times unit price, to the cent (half up, as invoices round)."""
        return (Decimal(self.quantity) * Decimal(self.unit_price)).quantize(
            CENT, rounding=ROUND_HALF_UP
        )

    __table_args__ = (
        ForeignKeyConstraint(
            ["claim_id", "estimate_id"], ["estimates.claim_id", "estimates.id"], ondelete="CASCADE"
        ),
        # Deleting a room leaves its lines on the estimate, without a room.
        ForeignKeyConstraint(
            ["claim_id", "room_id"], ["rooms.claim_id", "rooms.id"], ondelete="SET NULL (room_id)"
        ),
        Index("ix_estimate_lines_estimate_id_position", "estimate_id", "position"),
        Index("ix_estimate_lines_claim_id_room_id", "claim_id", "room_id"),
        CheckConstraint("quantity > 0", name="quantity_positive"),
        CheckConstraint("unit_price >= 0", name="unit_price_not_negative"),
        CheckConstraint("position > 0", name="position_positive"),
        CheckConstraint("unit ~ '^[A-Z]{1,10}$'", name="unit_valid"),
    )
