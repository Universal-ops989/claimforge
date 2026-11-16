"""Request and response schemas for price lists and items."""

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Self
from uuid import UUID

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    PlainSerializer,
    StringConstraints,
    WithJsonSchema,
    model_validator,
)


def _money_text(value: Decimal) -> str:
    return f"{value:.2f}"


#: Money travels as a decimal string ("42.15"): JavaScript numbers can't hold cents
#: exactly, and estimate totals must add up to the cent. Numbers are accepted too.
Money = Annotated[
    Decimal,
    Field(ge=0, max_digits=12, decimal_places=2),
    WithJsonSchema(
        {
            "type": "string",
            "pattern": r"^\d{1,10}(\.\d{1,2})?$",
            "description": "Dollars as a decimal string, to the cent",
            "examples": ["42.15"],
        }
    ),
    PlainSerializer(_money_text, return_type=str, when_used="json"),
]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None
Code = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=40),
    Field(examples=["WTR DHM"]),
]
ItemDescription = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=500),
    Field(examples=["Dehumidifier (per 24 hour period) - Large"]),
]


def _upper(value: object) -> object:
    return value.strip().upper() if isinstance(value, str) else value


Unit = Annotated[
    str,
    BeforeValidator(_upper),
    StringConstraints(pattern=r"^[A-Z]{1,10}$"),
    Field(description="Letters only, stored in capitals: EA, SF, LF, HR, DA …", examples=["DA"]),
]
Category = Annotated[str, StringConstraints(strip_whitespace=True, max_length=40)] | None


class PriceListCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Name
    description: Description = None
    effective_on: date | None = Field(default=None, description="When the prices are from")
    is_default: bool = Field(
        default=False, description="The list new estimates use; replaces the current default."
    )


class PriceListUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Name | None = None
    description: Description = None
    effective_on: date | None = None
    is_default: bool | None = None

    @model_validator(mode="after")
    def _required_stay(self) -> Self:
        for field in ("name", "is_default"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class PriceListRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    effective_on: date | None
    is_default: bool
    item_count: int
    created_at: datetime
    updated_at: datetime


class PriceItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: Code
    description: ItemDescription
    unit: Unit
    unit_price: Money
    category: Category = None


class PriceItemUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: Code | None = None
    description: ItemDescription | None = None
    unit: Unit | None = None
    unit_price: Money | None = None
    category: Category = None

    @model_validator(mode="after")
    def _required_stay(self) -> Self:
        for field in ("code", "description", "unit", "unit_price"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be cleared")
        return self


class PriceItemQuery(BaseModel):
    q: str | None = Field(default=None, max_length=100, description="Matches code or description")
    category: str | None = Field(default=None, max_length=40)


class PriceItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    code: str
    description: str
    unit: str
    unit_price: Money
    category: str | None
    updated_at: datetime
