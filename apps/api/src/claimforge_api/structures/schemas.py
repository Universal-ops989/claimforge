"""Request and response schemas for structures and rooms."""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Self
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    StringConstraints,
    WithJsonSchema,
    model_validator,
)

from claimforge_api.claims.schemas import Blankable

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Level = Annotated[
    Annotated[str, StringConstraints(strip_whitespace=True, max_length=40)] | None, Blankable
]
# Sent and returned as JSON numbers; stored exactly, to the hundredth of a foot. The
# schema says "number" only, so generated clients don't type dimensions as number | string.
Feet = Annotated[
    Decimal,
    Field(gt=0, max_digits=6, decimal_places=2),
    WithJsonSchema(
        {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 9999.99,
            "description": "Feet, to the hundredth (12' 6\" is 12.5)",
            "examples": [12.5],
        }
    ),
    PlainSerializer(float, return_type=float, when_used="json"),
]
Measure = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]


def _not_null(data: BaseModel, *fields: str) -> None:
    for field in fields:
        if field in data.model_fields_set and getattr(data, field) is None:
            raise ValueError(f"{field} cannot be cleared")


class StructureCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Name = Field(examples=["Main house"])


class StructureUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Name | None = None

    @model_validator(mode="after")
    def _name_stays(self) -> Self:
        _not_null(self, "name")
        return self


class RoomCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Name = Field(examples=["Kitchen"])
    level: Level = Field(default=None, examples=["Main floor"])
    length_ft: Feet | None = None
    width_ft: Feet | None = None
    height_ft: Feet | None = None


class RoomUpdate(BaseModel):
    """Only the fields sent change. ``structure_id`` moves the room within the claim."""

    model_config = ConfigDict(extra="forbid")

    structure_id: UUID | None = None
    name: Name | None = None
    level: Level = None
    length_ft: Feet | None = None
    width_ft: Feet | None = None
    height_ft: Feet | None = None

    @model_validator(mode="after")
    def _required_stay(self) -> Self:
        _not_null(self, "structure_id", "name")
        return self


class RoomRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    structure_id: UUID
    name: str
    level: str | None
    length_ft: Measure | None
    width_ft: Measure | None
    height_ft: Measure | None
    floor_area_sqft: Measure | None = Field(description="Length times width")
    wall_area_sqft: Measure | None = Field(
        description="Perimeter times height, gross: doors and windows are not deducted"
    )
    volume_cuft: Measure | None = Field(description="Length times width times height")
    created_at: datetime
    updated_at: datetime


class StructureRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    rooms: list[RoomRead]
    created_at: datetime
    updated_at: datetime
