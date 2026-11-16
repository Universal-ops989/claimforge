"""Moisture points: the spots on wet materials that are read on every monitoring visit.

Drying is shown by reading the same points day after day until each reaches its dry
standard (IICRC S500). A point is numbered on the claim's moisture map, sits in one room,
and is read on one scale for its whole life so its readings compare.
"""

from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from claimforge_api.damage.models import Surface
from claimforge_api.db.base import Base
from claimforge_api.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin
from claimforge_api.structures.models import Room


class MoistureScale(StrEnum):
    """What a point's readings mean."""

    #: Moisture content in percent: pin meters, and wood or drywall scales.
    PERCENT = "percent"
    #: A meter's own relative scale (pinless meters): only comparable on the same meter.
    REFERENCE = "reference"


def _in(column: str, values: type[StrEnum]) -> str:
    return f"{column} IN ({', '.join(sorted(repr(v.value) for v in values))})"


class MoisturePoint(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "moisture_points"
    __audited__ = True

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    claim_id: Mapped[UUID] = mapped_column(ForeignKey("claims.id", ondelete="CASCADE"))
    room_id: Mapped[UUID]
    #: On the claim's moisture map: "1", "2" … or whatever the team writes there.
    label: Mapped[str] = mapped_column(String(20))
    material: Mapped[str] = mapped_column(String(100))
    surface: Mapped[Surface] = mapped_column(String(20))
    scale: Mapped[MoistureScale] = mapped_column(String(20))
    notes: Mapped[str | None] = mapped_column(Text, default=None)

    room: Mapped[Room] = relationship(lazy="raise", viewonly=True)

    __table_args__ = (
        # RESTRICT: drying records are evidence, so a room can't take them down with it.
        ForeignKeyConstraint(
            ["claim_id", "room_id"], ["rooms.claim_id", "rooms.id"], ondelete="RESTRICT"
        ),
        # Readings point at (claim_id, id), so they can only be of their own claim's points.
        UniqueConstraint("claim_id", "id"),
        Index("uq_moisture_points_claim_id_label", "claim_id", func.lower(label), unique=True),
        Index("ix_moisture_points_claim_id_room_id", "claim_id", "room_id"),
        CheckConstraint(_in("surface", Surface), name="surface_valid"),
        CheckConstraint(_in("scale", MoistureScale), name="scale_valid"),
        CheckConstraint("btrim(label) <> ''", name="label_not_blank"),
    )
