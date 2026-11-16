"""Request and response schemas for moisture points."""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Self
from uuid import UUID

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    StringConstraints,
    WithJsonSchema,
    model_validator,
)

from claimforge_api.claims.schemas import ClaimActor
from claimforge_api.damage.models import Surface
from claimforge_api.moisture.models import MoistureScale

Label = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=20),
    Field(description="As on the moisture map; unique on the claim.", examples=["7"]),
]
Material = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=100),
    Field(examples=["Drywall"]),
]
Notes = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None


class MoisturePointCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    room_id: UUID = Field(description="A room of this claim.")
    label: Label | None = Field(
        default=None, description="Defaults to the next number not yet used on the claim."
    )
    material: Material
    surface: Surface
    scale: MoistureScale = Field(
        description="`percent` for moisture content, `reference` for a meter's own scale."
    )
    notes: Notes = None


class MoisturePointUpdate(BaseModel):
    """Only the fields sent change. The scale is fixed: readings on two scales don't compare."""

    model_config = ConfigDict(extra="forbid")

    room_id: UUID | None = None
    label: Label | None = None
    material: Material | None = None
    surface: Surface | None = None
    notes: Notes = None

    @model_validator(mode="after")
    def _required_stay(self) -> Self:
        for field in ("room_id", "label", "material", "surface"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be cleared")
        return self


class MoisturePointQuery(BaseModel):
    room_id: UUID | None = Field(default=None, description="Only this room's points")


class MoisturePointRoom(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class MoisturePointRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    room: MoisturePointRoom
    label: str
    material: str
    surface: Surface
    scale: MoistureScale
    notes: str | None
    created_at: datetime
    updated_at: datetime


MAX_READINGS = 500

# Sent and returned as JSON numbers; stored exactly, to one decimal place.
Value = Annotated[
    Decimal,
    Field(ge=0, max_digits=5, decimal_places=1),
    WithJsonSchema(
        {
            "type": "number",
            "minimum": 0,
            "maximum": 9999.9,
            "description": "On the point's scale, to one decimal place",
            "examples": [18.5],
        }
    ),
    PlainSerializer(float, return_type=float, when_used="json"),
]


class ReadingIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    point_id: UUID
    value: Value


class ReadingChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    point_id: UUID
    value: Value | None = Field(description="The corrected value; null removes the reading.")


def _one_per_point(points: list[UUID]) -> None:
    if len(set(points)) != len(points):
        raise ValueError("Each point can be read once per visit")


class MoistureLogCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    taken_at: AwareDatetime | None = Field(
        default=None, description="When the readings were taken. Defaults to now."
    )
    notes: Notes = None
    readings: list[ReadingIn] = Field(min_length=1, max_length=MAX_READINGS)

    @model_validator(mode="after")
    def _distinct_points(self) -> Self:
        _one_per_point([r.point_id for r in self.readings])
        return self


class MoistureLogUpdate(BaseModel):
    """Only the fields sent change. ``readings`` sets, adds or (with null) removes values."""

    model_config = ConfigDict(extra="forbid")

    taken_at: AwareDatetime | None = None
    notes: Notes = None
    readings: list[ReadingChange] = Field(default_factory=list, max_length=MAX_READINGS)

    @model_validator(mode="after")
    def _valid(self) -> Self:
        if "taken_at" in self.model_fields_set and self.taken_at is None:
            raise ValueError("taken_at cannot be cleared")
        _one_per_point([r.point_id for r in self.readings])
        return self


class ReadingRead(BaseModel):
    point_id: UUID
    label: str
    value: Value


class MoistureLogRead(BaseModel):
    id: UUID
    taken_at: datetime
    taken_by: ClaimActor | None = Field(description="Null once the account is gone")
    notes: str | None
    readings: list[ReadingRead] = Field(description="In the points' order")
    readings_edited_at: datetime | None = Field(description="When readings were last corrected")
    created_at: datetime
    updated_at: datetime


class DryingLogVisit(BaseModel):
    id: UUID
    taken_at: datetime
    taken_by: ClaimActor | None


class DryingLogPoint(BaseModel):
    id: UUID
    label: str
    material: str
    surface: Surface
    scale: MoistureScale
    values: list[Value | None] = Field(
        description="One per visit, in the visits' order; null where the point wasn't read"
    )


class DryingLogRoom(BaseModel):
    id: UUID
    name: str
    points: list[DryingLogPoint]


class DryingLog(BaseModel):
    """The monitoring table: points down the side, visits across the top."""

    visits: list[DryingLogVisit] = Field(description="Oldest first")
    rooms: list[DryingLogRoom] = Field(description="Rooms with points, in the points' order")


class DryingLogQuery(BaseModel):
    room_id: UUID | None = Field(default=None, description="Only this room's points")
