"""Moisture points: the spots on wet materials that are read on every monitoring visit.

Drying is shown by reading the same points day after day until each reaches its dry
standard (IICRC S500). A point is numbered on the claim's moisture map, sits in one room,
and is read on one scale for its whole life so its readings compare.
"""

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from claimforge_api.damage.models import Surface
from claimforge_api.db.base import Base
from claimforge_api.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin
from claimforge_api.equipment.models import EquipmentPlacement
from claimforge_api.moisture import psychrometrics
from claimforge_api.structures.models import Room
from claimforge_api.users.models import User

#: One decimal place, up to 9999.9: percent readings stay under 100, reference scales
#: run to 999 or so.
Reading = Numeric(5, 1)


class MoistureScale(StrEnum):
    """What a point's readings mean."""

    #: Moisture content in percent: pin meters, and wood or drywall scales.
    PERCENT = "percent"
    #: A meter's own relative scale (pinless meters): only comparable on the same meter.
    REFERENCE = "reference"


class GoalBasis(StrEnum):
    """How a point's dry standard was set: carriers ask."""

    #: Read on unaffected material of the same kind (IICRC S500's dry reference).
    REFERENCE = "reference"
    #: A manufacturer's or industry figure for the material.
    PUBLISHED = "published"
    MANUAL = "manual"


def _in(column: str, values: type[StrEnum]) -> str:
    return f"{column} IN ({', '.join(sorted(repr(v.value) for v in values))})"


#: A reading's point: joined on (claim_id, point_id), but only point_id is written through
#: it. claim_id comes with the reading's visit, which is of the same claim.
_POINT_JOIN = (
    "and_(MoistureReading.claim_id == MoisturePoint.claim_id, "
    "foreign(MoistureReading.point_id) == MoisturePoint.id)"
)


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
    #: The value, on the point's scale, at or below which its material counts as dry.
    dry_standard: Mapped[Decimal | None] = mapped_column(Reading, default=None)
    dry_standard_basis: Mapped[GoalBasis | None] = mapped_column(String(20), default=None)

    room: Mapped[Room] = relationship(lazy="raise", viewonly=True)
    # Loaded when the point is deleted, so each reading's removal is audited.
    readings: Mapped[list["MoistureReading"]] = relationship(
        back_populates="point",
        cascade="all, delete-orphan",
        lazy="raise",
        primaryjoin=_POINT_JOIN,
    )

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
        CheckConstraint(_in("dry_standard_basis", GoalBasis), name="dry_standard_basis_valid"),
        CheckConstraint(
            "(dry_standard IS NULL) = (dry_standard_basis IS NULL)",
            name="dry_standard_has_basis",
        ),
        CheckConstraint("dry_standard >= 0", name="dry_standard_not_negative"),
    )


class MoistureLog(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One monitoring visit: the readings taken at one time, by one person."""

    __tablename__ = "moisture_logs"
    __audited__ = True

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    claim_id: Mapped[UUID] = mapped_column(ForeignKey("claims.id", ondelete="CASCADE"))
    taken_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    taken_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )
    notes: Mapped[str | None] = mapped_column(Text, default=None)
    #: Set whenever readings are corrected, so the visit's history shows the correction
    #: (the readings themselves are audited, but kept out of the timeline).
    readings_edited_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )

    taken_by: Mapped[User | None] = relationship(lazy="raise")
    readings: Mapped[list["MoistureReading"]] = relationship(
        back_populates="log", cascade="all, delete-orphan", lazy="raise"
    )
    atmosphere: Mapped[list["AtmosphericReading"]] = relationship(
        back_populates="log", cascade="all, delete-orphan", lazy="raise"
    )

    __table_args__ = (
        UniqueConstraint("claim_id", "id"),
        # A claim's visits in time order: the drying log's columns.
        Index("ix_moisture_logs_claim_id_taken_at", "claim_id", "taken_at"),
    )


class MoistureReading(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A point's value on one visit, on the point's scale."""

    __tablename__ = "moisture_readings"
    __audited__ = True

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    claim_id: Mapped[UUID] = mapped_column(ForeignKey("claims.id", ondelete="CASCADE"))
    log_id: Mapped[UUID]
    point_id: Mapped[UUID]
    value: Mapped[Decimal] = mapped_column(Reading)

    log: Mapped[MoistureLog] = relationship(back_populates="readings", lazy="raise")
    point: Mapped[MoisturePoint] = relationship(
        back_populates="readings", lazy="raise", primaryjoin=_POINT_JOIN
    )

    __table_args__ = (
        # Through claim_id, a reading's visit and point are always of its own claim.
        ForeignKeyConstraint(
            ["claim_id", "log_id"],
            ["moisture_logs.claim_id", "moisture_logs.id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["claim_id", "point_id"],
            ["moisture_points.claim_id", "moisture_points.id"],
            ondelete="CASCADE",
        ),
        # One value per point per visit.
        UniqueConstraint("log_id", "point_id"),
        # A point's readings over time, and the cascade from a deleted point.
        Index("ix_moisture_readings_point_id", "point_id"),
        CheckConstraint("value >= 0", name="value_not_negative"),
    )


class AtmosphereLocation(StrEnum):
    """Where the air was read. Comparing them is what shows drying working."""

    OUTDOORS = "outdoors"
    #: A dry part of the building: the goal the affected air is brought down to.
    UNAFFECTED = "unaffected"
    ROOM = "room"  # an affected room
    #: A dehumidifier's exhaust: much drier than its room when it's doing its job.
    DEHUMIDIFIER = "dehumidifier"


#: Degrees Fahrenheit and percent relative humidity, to a tenth.
Tenths = Numeric(4, 1)


class AtmosphericReading(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Temperature and relative humidity at one place on one visit."""

    __tablename__ = "atmospheric_readings"
    __audited__ = True

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    claim_id: Mapped[UUID] = mapped_column(ForeignKey("claims.id", ondelete="CASCADE"))
    log_id: Mapped[UUID]
    location: Mapped[AtmosphereLocation] = mapped_column(String(20))
    room_id: Mapped[UUID | None] = mapped_column(default=None)
    placement_id: Mapped[UUID | None] = mapped_column(default=None)
    temperature_f: Mapped[Decimal] = mapped_column(Tenths)
    relative_humidity: Mapped[Decimal] = mapped_column(Tenths)

    log: Mapped[MoistureLog] = relationship(back_populates="atmosphere", lazy="raise")
    room: Mapped[Room | None] = relationship(lazy="raise", viewonly=True)
    placement: Mapped[EquipmentPlacement | None] = relationship(lazy="raise", viewonly=True)

    @property
    def grains_per_pound(self) -> Decimal:
        return psychrometrics.grains_per_pound(self.temperature_f, self.relative_humidity)

    @property
    def dew_point_f(self) -> Decimal | None:
        if self.relative_humidity <= 0:
            return None
        return psychrometrics.dew_point_f(self.temperature_f, self.relative_humidity)

    __table_args__ = (
        ForeignKeyConstraint(
            ["claim_id", "log_id"],
            ["moisture_logs.claim_id", "moisture_logs.id"],
            ondelete="CASCADE",
        ),
        # Evidence again: a room with readings can't be deleted.
        ForeignKeyConstraint(
            ["claim_id", "room_id"], ["rooms.claim_id", "rooms.id"], ondelete="RESTRICT"
        ),
        # A placement entered by mistake takes its exhaust readings with it.
        ForeignKeyConstraint(
            ["claim_id", "placement_id"],
            ["equipment_placements.claim_id", "equipment_placements.id"],
            ondelete="CASCADE",
        ),
        # Each place once per visit (outdoors has no room or placement: NULLs are equal here).
        Index(
            "uq_atmospheric_readings_place",
            "log_id",
            "location",
            "room_id",
            "placement_id",
            unique=True,
            postgresql_nulls_not_distinct=True,
        ),
        Index("ix_atmospheric_readings_claim_id_room_id", "claim_id", "room_id"),
        CheckConstraint(_in("location", AtmosphereLocation), name="location_valid"),
        CheckConstraint("(location = 'room') = (room_id IS NOT NULL)", name="room_iff_room"),
        CheckConstraint(
            "(location = 'dehumidifier') = (placement_id IS NOT NULL)",
            name="placement_iff_dehumidifier",
        ),
        CheckConstraint("temperature_f BETWEEN -40 AND 160", name="temperature_plausible"),
        CheckConstraint("relative_humidity BETWEEN 0 AND 100", name="humidity_valid"),
    )
