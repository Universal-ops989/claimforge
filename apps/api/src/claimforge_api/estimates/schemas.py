"""Request and response schemas for estimates and their lines."""

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

from claimforge_api.claims.schemas import ClaimActor
from claimforge_api.estimates.models import EstimateStatus
from claimforge_api.pricing.schemas import Code, ItemDescription, Money, Unit

Title = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=200),
    Field(examples=["Mitigation"]),
]
Notes = Annotated[str, StringConstraints(strip_whitespace=True, max_length=4000)] | None


def _quantity_text(value: Decimal) -> str:
    return f"{value:.2f}"


#: Like money, a decimal string ("125.50"), so totals are exact.
Quantity = Annotated[
    Decimal,
    Field(gt=0, max_digits=12, decimal_places=2),
    WithJsonSchema(
        {
            "type": "string",
            "pattern": r"^\d{1,10}(\.\d{1,2})?$",
            "description": "In the line's unit, as a decimal string, to a hundredth",
            "examples": ["125.50"],
        }
    ),
    PlainSerializer(_quantity_text, return_type=str, when_used="json"),
]
Position = Annotated[int, Field(ge=1, description="1 is first; later lines move down")]


def _percent_text(value: Decimal) -> str:
    return f"{value:.3f}".rstrip("0").rstrip(".")


#: A percentage as a decimal string to a thousandth: "8.25", "10".
Percent = Annotated[
    Decimal,
    Field(ge=0, le=100, decimal_places=3),
    WithJsonSchema(
        {
            "type": "string",
            "pattern": r"^\d{1,3}(\.\d{1,3})?$",
            "description": "Percent, as a decimal string to a thousandth",
            "examples": ["8.25"],
        }
    ),
    PlainSerializer(_percent_text, return_type=str, when_used="json"),
]


class EstimateCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Title
    price_list_id: UUID | None = Field(
        default=None, description="Defaults to the organization's default price list"
    )
    notes: Notes = None
    tax_percent: Percent = Field(default=Decimal(0), description="Sales tax on taxable lines")
    overhead_percent: Percent = Decimal(0)
    profit_percent: Percent = Decimal(0)


class EstimateUpdate(BaseModel):
    """Drafts only. ``price_list_id`` changes where new lines are priced from, not old ones."""

    model_config = ConfigDict(extra="forbid")

    title: Title | None = None
    price_list_id: UUID | None = None
    notes: Notes = None
    tax_percent: Percent | None = None
    overhead_percent: Percent | None = None
    profit_percent: Percent | None = None

    @model_validator(mode="after")
    def _title_stays(self) -> Self:
        for field in ("title", "tax_percent", "overhead_percent", "profit_percent"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be cleared")
        return self


class EstimateStatusChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: EstimateStatus


class LineCreate(BaseModel):
    """From a price item (``price_item_id``), or by hand (description, unit and price)."""

    model_config = ConfigDict(extra="forbid")

    price_item_id: UUID | None = None
    code: Code | None = None
    description: ItemDescription | None = None
    unit: Unit | None = None
    unit_price: Money | None = None
    quantity: Quantity
    taxable: bool = Field(default=True, description="Sales tax applies")
    room_id: UUID | None = Field(default=None, description="A room of this claim")
    notes: Notes = None
    position: Position | None = Field(default=None, description="Defaults to the end")

    @model_validator(mode="after")
    def _one_source(self) -> Self:
        by_hand = {"code", "description", "unit", "unit_price"} & self.model_fields_set
        if self.price_item_id is not None:
            if by_hand:
                raise ValueError(
                    "A line from a price item takes its code, description, unit and price "
                    "from it; edit the line afterwards to change them"
                )
        elif self.description is None or self.unit is None or self.unit_price is None:
            raise ValueError("Give a price_item_id, or a description, unit and unit_price")
        return self


class LineUpdate(BaseModel):
    """Drafts only. Only the fields sent change."""

    model_config = ConfigDict(extra="forbid")

    code: Code | None = None
    description: ItemDescription | None = None
    unit: Unit | None = None
    unit_price: Money | None = None
    quantity: Quantity | None = None
    taxable: bool | None = None
    room_id: UUID | None = None
    notes: Notes = None
    position: Position | None = None

    @model_validator(mode="after")
    def _required_stay(self) -> Self:
        for field in ("description", "unit", "unit_price", "quantity", "taxable", "position"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be cleared")
        return self


class LineRoom(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class LineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    position: int
    room: LineRoom | None
    price_item_id: UUID | None = Field(description="Where it was priced from; null by hand")
    code: str | None
    description: str
    unit: str
    quantity: Quantity
    unit_price: Money
    total: Money = Field(description="Quantity times unit price, to the cent")
    taxable: bool
    notes: str | None


class EstimatePriceList(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class EstimateTotals(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    subtotal: Money = Field(description="The lines' totals")
    taxable_subtotal: Money = Field(description="The taxable lines' totals")
    tax: Money = Field(description="Taxable subtotal times the tax rate")
    overhead: Money = Field(description="(Subtotal + tax) times the overhead rate")
    profit: Money = Field(description="(Subtotal + tax) times the profit rate")
    total: Money = Field(description="Subtotal + tax + overhead + profit")


class EstimateSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    claim_id: UUID
    number: int
    title: str
    status: EstimateStatus
    total: Money
    created_at: datetime
    updated_at: datetime


class EstimateRead(EstimateSummary):
    price_list: EstimatePriceList | None
    notes: str | None
    tax_percent: Percent
    overhead_percent: Percent
    profit_percent: Percent
    totals: EstimateTotals
    created_by: ClaimActor | None
    next_statuses: list[EstimateStatus] = Field(
        description="Where the estimate can go from here (permissions permitting)"
    )
    lines: list[LineRead]
