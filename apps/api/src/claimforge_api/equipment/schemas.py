"""Request and response schemas for the equipment inventory."""

from datetime import datetime
from typing import Annotated, Self
from uuid import UUID

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    model_validator,
)

from claimforge_api.claims.schemas import ClaimActor, ClaimRef
from claimforge_api.equipment.models import CapacityUnit, EquipmentKind, EquipmentStatus

Name = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=100),
    Field(examples=["Phoenix 200 MAX"]),
]
AssetTag = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=40),
    Field(description="As printed on the unit; unique in the organization.", examples=["D-12"]),
]
Serial = Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] | None
Notes = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None
Capacity = Annotated[
    int | None,
    Field(
        gt=0,
        le=10_000_000,
        description="Pints per day for dehumidifiers, CFM for desiccants, air movers and "
        "scrubbers, BTU per hour for heaters (see `capacity_unit`).",
    ),
]


class EquipmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: EquipmentKind
    name: Name
    asset_tag: AssetTag
    serial_number: Serial = None
    capacity: Capacity = None
    status: EquipmentStatus = EquipmentStatus.IN_SERVICE
    notes: Notes = None


class EquipmentUpdate(BaseModel):
    """Only the fields sent change."""

    model_config = ConfigDict(extra="forbid")

    kind: EquipmentKind | None = None
    name: Name | None = None
    asset_tag: AssetTag | None = None
    serial_number: Serial = None
    capacity: Capacity = None
    status: EquipmentStatus | None = None
    notes: Notes = None

    @model_validator(mode="after")
    def _required_stay(self) -> Self:
        for field in ("kind", "name", "asset_tag", "status"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be cleared")
        return self


class EquipmentQuery(BaseModel):
    kind: EquipmentKind | None = None
    status: EquipmentStatus | None = None
    q: str | None = Field(
        default=None, max_length=100, description="Matches asset tag, name or serial number"
    )
    available: bool | None = Field(
        default=None,
        description="true: in service and not running anywhere (free to place); "
        "false: everything else",
    )


class CurrentPlacement(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    claim: ClaimRef
    room_id: UUID
    placed_at: datetime


class EquipmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kind: EquipmentKind
    name: str
    asset_tag: str
    serial_number: str | None
    capacity: int | None
    capacity_unit: CapacityUnit | None = Field(description="Set by the kind")
    status: EquipmentStatus
    notes: str | None
    current_placement: CurrentPlacement | None = Field(description="Where it's running now")
    created_at: datetime
    updated_at: datetime


class PlacementCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    equipment_id: UUID
    room_id: UUID = Field(description="A room of this claim.")
    placed_at: AwareDatetime | None = Field(default=None, description="Defaults to now.")


class PlacementRemove(BaseModel):
    model_config = ConfigDict(extra="forbid")

    removed_at: AwareDatetime | None = Field(default=None, description="Defaults to now.")


class PlacementUpdate(BaseModel):
    """Corrections. ``removed_at: null`` puts a unit pulled by mistake back to running."""

    model_config = ConfigDict(extra="forbid")

    room_id: UUID | None = None
    placed_at: AwareDatetime | None = None
    removed_at: AwareDatetime | None = None

    @model_validator(mode="after")
    def _required_stay(self) -> Self:
        for field in ("room_id", "placed_at"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be cleared")
        return self


class PlacementQuery(BaseModel):
    running: bool | None = Field(default=None, description="Only running (or only removed)")
    room_id: UUID | None = None


class PlacedEquipment(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kind: EquipmentKind
    name: str
    asset_tag: str


class PlacementRoom(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class PlacementRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    equipment: PlacedEquipment
    room: PlacementRoom
    placed_at: datetime
    removed_at: datetime | None
    running: bool
    days: int = Field(description="Billable days: every started 24 hours (so far, if running)")
    placed_by: ClaimActor | None
    removed_by: ClaimActor | None


class EquipmentDays(BaseModel):
    """A claim's equipment use for one kind: what estimates bill."""

    kind: EquipmentKind
    placements: int
    running: int = Field(description="Placements still running")
    days: int = Field(description="Billable days, running placements counted up to now")
