"""The organization's drying equipment, one row per unit, and where each unit runs."""

import math
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from claimforge_api.claims.models import Claim
from claimforge_api.db.base import Base
from claimforge_api.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin
from claimforge_api.structures.models import Room
from claimforge_api.users.models import User

DAY = timedelta(hours=24)


class EquipmentKind(StrEnum):
    #: Refrigerant dehumidifiers, LGR (low grain refrigerant) included.
    DEHUMIDIFIER = "dehumidifier"
    DESICCANT_DEHUMIDIFIER = "desiccant_dehumidifier"
    AIR_MOVER = "air_mover"
    AIR_SCRUBBER = "air_scrubber"
    HEATER = "heater"
    OTHER = "other"


class CapacityUnit(StrEnum):
    PINTS_PER_DAY = "pints_per_day"  # AHAM rating of refrigerant dehumidifiers
    CFM = "cfm"  # airflow: desiccants, air movers, scrubbers
    BTU_PER_HOUR = "btu_per_hour"


#: How each kind's capacity is rated; kinds without one have no capacity.
CAPACITY_UNITS: dict[EquipmentKind, CapacityUnit] = {
    EquipmentKind.DEHUMIDIFIER: CapacityUnit.PINTS_PER_DAY,
    EquipmentKind.DESICCANT_DEHUMIDIFIER: CapacityUnit.CFM,
    EquipmentKind.AIR_MOVER: CapacityUnit.CFM,
    EquipmentKind.AIR_SCRUBBER: CapacityUnit.CFM,
    EquipmentKind.HEATER: CapacityUnit.BTU_PER_HOUR,
}


class EquipmentStatus(StrEnum):
    IN_SERVICE = "in_service"
    MAINTENANCE = "maintenance"  # can't be placed until it's back in service
    RETIRED = "retired"  # kept for the history of the jobs it ran on


def _in(column: str, values: type[StrEnum]) -> str:
    return f"{column} IN ({', '.join(sorted(repr(v.value) for v in values))})"


class Equipment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "equipment"
    __audited__ = True

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    kind: Mapped[EquipmentKind] = mapped_column(String(30))
    #: Make and model, as the team calls it: "Phoenix 200 MAX".
    name: Mapped[str] = mapped_column(String(100))
    #: As printed on the unit; unique in the organization, ignoring case.
    asset_tag: Mapped[str] = mapped_column(String(40))
    serial_number: Mapped[str | None] = mapped_column(String(100), default=None)
    #: In the kind's unit (see CAPACITY_UNITS).
    capacity: Mapped[int | None] = mapped_column(Integer, default=None)
    status: Mapped[EquipmentStatus] = mapped_column(String(20), default=EquipmentStatus.IN_SERVICE)
    notes: Mapped[str | None] = mapped_column(Text, default=None)

    #: The placement the unit is running on now, if any.
    current_placement: Mapped["EquipmentPlacement | None"] = relationship(
        primaryjoin="and_(EquipmentPlacement.equipment_id == Equipment.id, "
        "EquipmentPlacement.removed_at.is_(None))",
        viewonly=True,
        uselist=False,
        lazy="raise",
    )

    @property
    def capacity_unit(self) -> CapacityUnit | None:
        return CAPACITY_UNITS.get(EquipmentKind(self.kind))

    __table_args__ = (
        Index(
            "uq_equipment_organization_id_asset_tag",
            "organization_id",
            func.lower(asset_tag),
            unique=True,
        ),
        Index("ix_equipment_organization_id_kind", "organization_id", "kind"),
        CheckConstraint(_in("kind", EquipmentKind), name="kind_valid"),
        CheckConstraint(_in("status", EquipmentStatus), name="status_valid"),
        CheckConstraint("capacity > 0", name="capacity_positive"),
        CheckConstraint("btrim(asset_tag) <> ''", name="asset_tag_not_blank"),
    )


def equipment_days(placed_at: datetime, removed_at: datetime) -> int:
    """Billable days: every started 24 hours counts, so 3 hours is 1 day and 25 is 2."""
    seconds = max((removed_at - placed_at).total_seconds(), 0)
    return max(1, math.ceil(seconds / DAY.total_seconds()))


class EquipmentPlacement(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A unit running in a room of a claim, from ``placed_at`` until ``removed_at``."""

    __tablename__ = "equipment_placements"
    __audited__ = True

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    claim_id: Mapped[UUID] = mapped_column(ForeignKey("claims.id", ondelete="CASCADE"))
    room_id: Mapped[UUID]
    # RESTRICT: a unit that worked a job is retired, not deleted, so its history stays.
    equipment_id: Mapped[UUID] = mapped_column(ForeignKey("equipment.id", ondelete="RESTRICT"))
    #: The unit as it was when placed, so history reads right after it's renamed.
    kind: Mapped[EquipmentKind] = mapped_column(String(30))
    asset_tag: Mapped[str] = mapped_column(String(40))
    placed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    placed_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )
    removed_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )

    equipment: Mapped[Equipment] = relationship(lazy="raise")
    room: Mapped[Room] = relationship(lazy="raise", viewonly=True)
    claim: Mapped[Claim] = relationship(lazy="raise", viewonly=True)
    placed_by: Mapped[User | None] = relationship(lazy="raise", foreign_keys=[placed_by_id])
    removed_by: Mapped[User | None] = relationship(lazy="raise", foreign_keys=[removed_by_id])

    @property
    def running(self) -> bool:
        return self.removed_at is None

    @property
    def days(self) -> int:
        """Billable days so far (still running: up to now)."""
        return equipment_days(self.placed_at, self.removed_at or datetime.now(UTC))

    __table_args__ = (
        # Drying records are evidence: a room can't take its equipment history with it.
        ForeignKeyConstraint(
            ["claim_id", "room_id"], ["rooms.claim_id", "rooms.id"], ondelete="RESTRICT"
        ),
        # A unit runs in one place at a time.
        Index(
            "uq_equipment_placements_running",
            "equipment_id",
            unique=True,
            postgresql_where=text("removed_at IS NULL"),
        ),
        Index("ix_equipment_placements_claim_id_placed_at", "claim_id", "placed_at"),
        Index("ix_equipment_placements_claim_id_room_id", "claim_id", "room_id"),
        CheckConstraint("removed_at >= placed_at", name="removed_after_placed"),
    )
