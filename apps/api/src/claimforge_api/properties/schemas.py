"""Request and response schemas for properties."""

from datetime import UTC, datetime
from typing import Annotated, Self
from uuid import UUID

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StringConstraints,
    model_validator,
)

from claimforge_api.core.addresses import AddressInput, is_po_box
from claimforge_api.properties.models import PropertyType


def _blank_to_none(value: object) -> object:
    return None if isinstance(value, str) and not value.strip() else value


def _physical(address: AddressInput) -> AddressInput:
    if is_po_box(address.line1):
        raise ValueError("A loss location must be a physical address, not a PO box")
    return address


def _not_in_the_future(year: int) -> int:
    # Next year is allowed: new construction is often sold before it is finished.
    if year > datetime.now(UTC).year + 1:
        raise ValueError("year_built cannot be in the future")
    return year


LossAddress = Annotated[AddressInput, AfterValidator(_physical)]
YearBuilt = Annotated[int, Field(ge=1600), AfterValidator(_not_in_the_future)]
Latitude = Annotated[float, Field(ge=-90, le=90)]
Longitude = Annotated[float, Field(ge=-180, le=180)]
AccessNotes = Annotated[
    Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None,
    BeforeValidator(_blank_to_none),
]


class PropertyCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    address: LossAddress
    property_type: PropertyType = PropertyType.RESIDENTIAL
    year_built: YearBuilt | None = None
    latitude: Latitude | None = None
    longitude: Longitude | None = None
    access_notes: AccessNotes = None

    @model_validator(mode="after")
    def _coordinates_pair(self) -> Self:
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be given together")
        return self


class PropertyUpdate(BaseModel):
    """Partial update. ``address`` replaces the whole address; ``null`` clears optional fields."""

    model_config = ConfigDict(extra="forbid")

    address: LossAddress | None = None
    property_type: PropertyType | None = None
    year_built: YearBuilt | None = None
    latitude: Latitude | None = None
    longitude: Longitude | None = None
    access_notes: AccessNotes = None

    @model_validator(mode="after")
    def _consistent(self) -> Self:
        given = self.model_fields_set
        for field in ("address", "property_type"):
            if field in given and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be cleared")
        if ("latitude" in given) != ("longitude" in given) or (
            (self.latitude is None) != (self.longitude is None)
        ):
            raise ValueError("latitude and longitude must be changed together")
        return self


class AddressRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    line1: str
    line2: str | None
    city: str
    region: str | None
    postal_code: str | None
    country: str
    formatted: str = Field(description='One line, e.g. "123 N Main St Apt 4B, Austin, TX 78701"')


class PropertyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    address: AddressRead
    property_type: PropertyType
    year_built: int | None
    latitude: float | None
    longitude: float | None
    access_notes: str | None
    created_at: datetime
    updated_at: datetime
