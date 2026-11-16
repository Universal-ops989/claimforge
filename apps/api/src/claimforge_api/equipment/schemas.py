"""Request and response schemas for the equipment inventory."""

from datetime import datetime
from typing import Annotated, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

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
    created_at: datetime
    updated_at: datetime
