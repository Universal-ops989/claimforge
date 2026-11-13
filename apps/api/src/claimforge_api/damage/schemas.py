"""Request and response schemas for damage items."""

from datetime import datetime
from typing import Annotated, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from claimforge_api.claims.models import LossType
from claimforge_api.claims.schemas import Blankable
from claimforge_api.damage.models import Surface

Material = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Description = Annotated[
    Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None, Blankable
]
WaterCategory = Annotated[
    int,
    Field(ge=1, le=3, description="IICRC S500: 1 clean, 2 grey, 3 black (sewage, flood water)"),
]
WaterClass = Annotated[
    int,
    Field(
        ge=1,
        le=4,
        description="IICRC S500: 1-3 by how much water there is to evaporate, "
        "4 specialty drying (hardwood, plaster, concrete)",
    ),
]

_WATER_RULES = (
    "Water category and class apply only to water, flood, sewage and storm damage. Sewage "
    "and flood water are always Category 3, which is the default for them."
)


class DamageItemCreate(BaseModel):
    __doc__ = f"One damaged material in a room. {_WATER_RULES}"

    model_config = ConfigDict(extra="forbid")

    surface: Surface
    material: Material = Field(examples=["Drywall"])
    description: Description = Field(default=None, examples=["Wet to 24 in. along the north wall"])
    cause: LossType | None = Field(default=None, description="Defaults to the claim's loss type")
    water_category: WaterCategory | None = None
    water_class: WaterClass | None = None


class DamageItemUpdate(BaseModel):
    __doc__ = (
        "Only the fields sent change; `null` clears the description or a water detail. "
        f"`room_id` moves the item to another room of the claim. {_WATER_RULES}"
    )

    model_config = ConfigDict(extra="forbid")

    room_id: UUID | None = None
    surface: Surface | None = None
    material: Material | None = None
    description: Description = None
    cause: LossType | None = None
    water_category: WaterCategory | None = None
    water_class: WaterClass | None = None

    @model_validator(mode="after")
    def _required_stay(self) -> Self:
        for field in ("room_id", "surface", "material", "cause"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be cleared")
        return self


class DamageItemQuery(BaseModel):
    room_id: UUID | None = None
    cause: LossType | None = None


class DamageItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    room_id: UUID
    surface: Surface
    material: str
    description: str | None
    cause: LossType
    water_category: int | None
    water_class: int | None
    created_by_id: UUID | None
    created_at: datetime
    updated_at: datetime
