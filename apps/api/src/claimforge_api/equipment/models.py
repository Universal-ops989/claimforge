"""The organization's drying equipment, one row per physical unit."""

from enum import StrEnum
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from claimforge_api.db.base import Base
from claimforge_api.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin


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
