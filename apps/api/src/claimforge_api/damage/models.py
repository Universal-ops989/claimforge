"""Damage items: one damaged material in one room, what caused it and how bad the water is.

Water category and class follow the IICRC S500 standard for water damage restoration:

    category  how contaminated the water is: 1 clean, 2 grey (significant contamination),
              3 black (grossly contaminated: sewage, rising flood water)
    class     how much water there is to evaporate: 1 least ... 3 most, 4 specialty drying
              (materials that hold water tightly, such as hardwood, plaster or concrete)
"""

from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    SmallInteger,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from claimforge_api.claims.models import LossType
from claimforge_api.db.base import Base
from claimforge_api.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin
from claimforge_api.structures.models import Room


class Surface(StrEnum):
    """Where in the room the damaged material is."""

    FLOOR = "floor"
    WALL = "wall"
    CEILING = "ceiling"
    CABINETRY = "cabinetry"
    TRIM = "trim"
    FIXTURE = "fixture"
    CONTENTS = "contents"
    OTHER = "other"


#: Causes whose damage can carry a water category and class.
WATER_CAUSES = frozenset({LossType.WATER, LossType.FLOOD, LossType.SEWAGE, LossType.STORM})
#: Causes whose water is always Category 3.
BLACK_WATER_CAUSES = frozenset({LossType.FLOOD, LossType.SEWAGE})


def _in(column: str, values: frozenset[LossType] | type[StrEnum]) -> str:
    return f"{column} IN ({', '.join(sorted(repr(v.value) for v in values))})"


class DamageItem(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "damage_items"
    __audited__ = True

    # Denormalized from the room so tenant scoping and claim-wide lists need no join.
    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    claim_id: Mapped[UUID] = mapped_column(ForeignKey("claims.id", ondelete="CASCADE"))
    room_id: Mapped[UUID]
    surface: Mapped[Surface] = mapped_column(String(20))
    material: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    cause: Mapped[LossType] = mapped_column(String(20))
    water_category: Mapped[int | None] = mapped_column(SmallInteger, default=None)
    water_class: Mapped[int | None] = mapped_column(SmallInteger, default=None)
    created_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )

    room: Mapped[Room] = relationship(back_populates="damage_items", lazy="raise")

    __table_args__ = (
        # Through (claim_id, room_id), an item can only sit in its own claim's rooms.
        ForeignKeyConstraint(
            ["claim_id", "room_id"], ["rooms.claim_id", "rooms.id"], ondelete="CASCADE"
        ),
        # A claim's items, a room's items, and the cascade from a deleted room.
        Index("ix_damage_items_claim_id_room_id", "claim_id", "room_id"),
        CheckConstraint(_in("surface", Surface), name="surface_valid"),
        CheckConstraint(_in("cause", LossType), name="cause_valid"),
        CheckConstraint("water_category BETWEEN 1 AND 3", name="water_category_valid"),
        CheckConstraint("water_class BETWEEN 1 AND 4", name="water_class_valid"),
        CheckConstraint(
            f"{_in('cause', WATER_CAUSES)} OR (water_category IS NULL AND water_class IS NULL)",
            name="water_details_need_water",
        ),
        # Not "= 3": a CHECK passes when it evaluates to NULL, which would let a missing
        # category through.
        CheckConstraint(
            f"NOT {_in('cause', BLACK_WATER_CAUSES)} OR water_category IS NOT DISTINCT FROM 3",
            name="black_water_is_category_3",
        ),
    )
