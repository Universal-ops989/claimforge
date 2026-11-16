"""Request and response schemas for moisture points."""

from datetime import datetime
from typing import Annotated, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

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
