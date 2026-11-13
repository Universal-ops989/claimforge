"""The buildings at a loss location and the rooms inside them, as documented for one claim.

Rooms are what field work hangs off: damage items, photos, moisture readings and equipment
placement all point at a room. They belong to the claim rather than to the property because
each loss is documented as found; the next claim at the same address starts fresh.
"""

from decimal import ROUND_HALF_UP, Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from claimforge_api.db.base import Base
from claimforge_api.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from claimforge_api.damage.models import DamageItem

#: Feet with two decimals (12' 6" is 12.50), up to 9999.99.
Feet = Numeric(6, 2)
_CENT = Decimal("0.01")


class Structure(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A building on the property: the house, a detached garage, a shed."""

    __tablename__ = "structures"
    __audited__ = True

    # Denormalized from the claim so tenant scoping and the audit log need no join.
    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    claim_id: Mapped[UUID] = mapped_column(ForeignKey("claims.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100))

    rooms: Mapped[list["Room"]] = relationship(
        back_populates="structure",
        cascade="all, delete-orphan",
        lazy="raise",
        order_by="Room.id",
    )

    __table_args__ = (
        # The target of the rooms' (claim_id, structure_id) foreign key.
        UniqueConstraint("claim_id", "id"),
        Index("uq_structures_claim_id_name", "claim_id", func.lower(name), unique=True),
    )


class Room(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A room or area inside a structure, with optional dimensions in feet."""

    __tablename__ = "rooms"
    __audited__ = True

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    claim_id: Mapped[UUID] = mapped_column(ForeignKey("claims.id", ondelete="CASCADE"))
    structure_id: Mapped[UUID]
    name: Mapped[str] = mapped_column(String(100))
    # Free text, because floors are named rather than numbered: "Basement", "Attic".
    level: Mapped[str | None] = mapped_column(String(40), default=None)
    length_ft: Mapped[Decimal | None] = mapped_column(Feet, default=None)
    width_ft: Mapped[Decimal | None] = mapped_column(Feet, default=None)
    height_ft: Mapped[Decimal | None] = mapped_column(Feet, default=None)

    structure: Mapped[Structure] = relationship(back_populates="rooms", lazy="raise")
    # Loaded before a room or structure is deleted, so each item's removal is audited.
    damage_items: Mapped[list["DamageItem"]] = relationship(
        back_populates="room",
        cascade="all, delete-orphan",
        lazy="raise",
        order_by="DamageItem.id",
    )

    __table_args__ = (
        # Through (claim_id, structure_id), a room can only sit in its own claim's structures.
        ForeignKeyConstraint(
            ["claim_id", "structure_id"],
            ["structures.claim_id", "structures.id"],
            ondelete="CASCADE",
        ),
        # The target of the damage items' (claim_id, room_id) foreign key.
        UniqueConstraint("claim_id", "id"),
        Index("uq_rooms_structure_id_name", "structure_id", func.lower(name), unique=True),
        # Every room of a claim, and the cascade from a deleted structure.
        Index("ix_rooms_claim_id_structure_id", "claim_id", "structure_id"),
        CheckConstraint("length_ft > 0", name="length_positive"),
        CheckConstraint("width_ft > 0", name="width_positive"),
        CheckConstraint("height_ft > 0", name="height_positive"),
    )

    @property
    def floor_area_sqft(self) -> Decimal | None:
        if self.length_ft is None or self.width_ft is None:
            return None
        return (self.length_ft * self.width_ft).quantize(_CENT, ROUND_HALF_UP)

    @property
    def wall_area_sqft(self) -> Decimal | None:
        """Gross: doors and windows are not deducted."""
        if self.length_ft is None or self.width_ft is None or self.height_ft is None:
            return None
        return (2 * (self.length_ft + self.width_ft) * self.height_ft).quantize(
            _CENT, ROUND_HALF_UP
        )

    @property
    def volume_cuft(self) -> Decimal | None:
        """What dehumidifiers and air movers are sized by."""
        if self.length_ft is None or self.width_ft is None or self.height_ft is None:
            return None
        return (self.length_ft * self.width_ft * self.height_ft).quantize(_CENT, ROUND_HALF_UP)
