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
from claimforge_api.moisture.alerts import AlertKind
from claimforge_api.moisture.goals import DryingStatus
from claimforge_api.moisture.models import AtmosphereLocation, GoalBasis, MoistureScale

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


def _check_goal(goal: Decimal | None, basis: GoalBasis | None) -> None:
    if (goal is None) != (basis is None):
        raise ValueError("A dry standard needs its basis, and a basis its dry standard")


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
    dry_standard: Value | None = Field(
        default=None, description="The goal on the point's scale: at or below it is dry."
    )
    dry_standard_basis: GoalBasis | None = Field(
        default=None, description="How the goal was set; required with `dry_standard`."
    )

    @model_validator(mode="after")
    def _goal_has_basis(self) -> Self:
        _check_goal(self.dry_standard, self.dry_standard_basis)
        return self


class MoisturePointUpdate(BaseModel):
    """Only the fields sent change. The scale is fixed: readings on two scales don't compare."""

    model_config = ConfigDict(extra="forbid")

    room_id: UUID | None = None
    label: Label | None = None
    material: Material | None = None
    surface: Surface | None = None
    notes: Notes = None
    dry_standard: Value | None = Field(
        default=None, description="Send with `dry_standard_basis`; both null clear the goal."
    )
    dry_standard_basis: GoalBasis | None = None

    @model_validator(mode="after")
    def _required_stay(self) -> Self:
        for field in ("room_id", "label", "material", "surface"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be cleared")
        goal = {"dry_standard", "dry_standard_basis"} & self.model_fields_set
        if goal and len(goal) != 2:
            raise ValueError("Send dry_standard and dry_standard_basis together")
        _check_goal(self.dry_standard, self.dry_standard_basis)
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
    dry_standard: Value | None
    dry_standard_basis: GoalBasis | None
    created_at: datetime
    updated_at: datetime


MAX_READINGS = 500


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


Fahrenheit = Annotated[
    Decimal,
    Field(ge=-40, le=160, decimal_places=1),
    WithJsonSchema(
        {
            "type": "number",
            "minimum": -40,
            "maximum": 160,
            "description": "Degrees Fahrenheit, to a tenth",
            "examples": [72.5],
        }
    ),
    PlainSerializer(float, return_type=float, when_used="json"),
]
Humidity = Annotated[
    Decimal,
    Field(ge=0, le=100, decimal_places=1),
    WithJsonSchema(
        {
            "type": "number",
            "minimum": 0,
            "maximum": 100,
            "description": "Relative humidity in percent, to a tenth",
            "examples": [55],
        }
    ),
    PlainSerializer(float, return_type=float, when_used="json"),
]
Grains = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]


class AtmosphereIn(BaseModel):
    """One place's air. ``room_id`` for a room; ``placement_id`` for a dehumidifier's exhaust."""

    model_config = ConfigDict(extra="forbid")

    location: AtmosphereLocation
    room_id: UUID | None = Field(default=None, description="With `location: room`")
    placement_id: UUID | None = Field(
        default=None, description="With `location: dehumidifier`: the unit's placement"
    )
    temperature_f: Fahrenheit
    relative_humidity: Humidity

    @model_validator(mode="after")
    def _place(self) -> Self:
        room, unit = AtmosphereLocation.ROOM, AtmosphereLocation.DEHUMIDIFIER
        if (self.location == room) != (self.room_id is not None):
            raise ValueError("room_id goes with location room, and only with it")
        if (self.location == unit) != (self.placement_id is not None):
            raise ValueError("placement_id goes with location dehumidifier, and only with it")
        return self

    @property
    def place(self) -> tuple[AtmosphereLocation, UUID | None]:
        return self.location, self.room_id or self.placement_id


def _one_per_place(atmosphere: list[AtmosphereIn]) -> None:
    places = [a.place for a in atmosphere]
    if len(set(places)) != len(places):
        raise ValueError("Each place's air can be read once per visit")


class MoistureLogCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    taken_at: AwareDatetime | None = Field(
        default=None, description="When the readings were taken. Defaults to now."
    )
    notes: Notes = None
    readings: list[ReadingIn] = Field(default_factory=list, max_length=MAX_READINGS)
    atmosphere: list[AtmosphereIn] = Field(default_factory=list, max_length=MAX_READINGS)

    @model_validator(mode="after")
    def _valid(self) -> Self:
        if not self.readings and not self.atmosphere:
            raise ValueError("A visit needs moisture readings, atmospheric readings or both")
        _one_per_point([r.point_id for r in self.readings])
        _one_per_place(self.atmosphere)
        return self


class MoistureLogUpdate(BaseModel):
    """Only the fields sent change. ``readings`` sets, adds or (with null) removes values;
    ``atmosphere``, when sent, replaces the visit's atmospheric readings."""

    model_config = ConfigDict(extra="forbid")

    taken_at: AwareDatetime | None = None
    notes: Notes = None
    readings: list[ReadingChange] = Field(default_factory=list, max_length=MAX_READINGS)
    atmosphere: list[AtmosphereIn] | None = Field(default=None, max_length=MAX_READINGS)

    @model_validator(mode="after")
    def _valid(self) -> Self:
        if "taken_at" in self.model_fields_set and self.taken_at is None:
            raise ValueError("taken_at cannot be cleared")
        _one_per_point([r.point_id for r in self.readings])
        _one_per_place(self.atmosphere or [])
        return self


class ReadingRead(BaseModel):
    point_id: UUID
    label: str
    value: Value


class AtmosphereRoom(BaseModel):
    id: UUID
    name: str


class AtmosphereUnit(BaseModel):
    placement_id: UUID
    asset_tag: str


class AtmosphereRead(BaseModel):
    location: AtmosphereLocation
    room: AtmosphereRoom | None
    dehumidifier: AtmosphereUnit | None
    temperature_f: Fahrenheit
    relative_humidity: Humidity
    grains_per_pound: Grains = Field(description="Grains of water per pound of dry air")
    dew_point_f: Grains | None = Field(description="Null for bone-dry air (0% RH)")


class MoistureLogRead(BaseModel):
    id: UUID
    taken_at: datetime
    taken_by: ClaimActor | None = Field(description="Null once the account is gone")
    notes: str | None
    readings: list[ReadingRead] = Field(description="In the points' order")
    atmosphere: list[AtmosphereRead] = Field(
        description="Outdoors, unaffected, rooms, then dehumidifiers"
    )
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
    dry_standard: Value | None
    dry_standard_basis: GoalBasis | None
    status: DryingStatus = Field(
        description="`dry`: latest reading at or below the goal; `drying`; `no_goal`; `not_read`"
    )
    dried_at: datetime | None = Field(
        description="When the point's current run of dry readings began"
    )
    values: list[Value | None] = Field(
        description="One per visit, in the visits' order; null where the point wasn't read"
    )


class DryingLogRoom(BaseModel):
    id: UUID
    name: str
    points: list[DryingLogPoint]


class DryingLogAirValue(BaseModel):
    temperature_f: Fahrenheit
    relative_humidity: Humidity
    grains_per_pound: Grains
    dew_point_f: Grains | None
    grain_depression: Grains | None = Field(
        description="Dehumidifiers: the room's GPP minus the exhaust's on this visit; null "
        "without a room reading. Low or negative: the unit isn't pulling water out."
    )


class DryingLogAir(BaseModel):
    location: AtmosphereLocation
    room: AtmosphereRoom | None
    dehumidifier: AtmosphereUnit | None
    values: list[DryingLogAirValue | None] = Field(
        description="One per visit, in the visits' order; null where it wasn't read"
    )


class DryingLog(BaseModel):
    """The monitoring table: points down the side, visits across the top."""

    visits: list[DryingLogVisit] = Field(description="Oldest first")
    rooms: list[DryingLogRoom] = Field(description="Rooms with points, in the points' order")
    atmosphere: list[DryingLogAir] = Field(
        description="Outdoors, unaffected, rooms, then dehumidifiers"
    )


class DryingLogQuery(BaseModel):
    room_id: UUID | None = Field(default=None, description="Only this room's points")


class DryingSummary(BaseModel):
    points: int
    dry: int
    drying: int
    no_goal: int
    not_read: int
    all_dry: bool = Field(description="There are points, and every one is dry")
    last_visit_at: datetime | None


class AlertPoint(BaseModel):
    id: UUID
    label: str


class AlertEquipment(BaseModel):
    placement_id: UUID
    asset_tag: str


class DryingAlert(BaseModel):
    kind: AlertKind = Field(
        description="`no_goal`: read but no dry standard; `stalled`: no improvement over "
        "the last 3 readings; `monitoring_gap`: still drying, not read for over 24 hours; "
        "`equipment_in_dry_room`: equipment running where every point is dry"
    )
    message: str
    point: AlertPoint | None
    room: AtmosphereRoom | None
    equipment: AlertEquipment | None
    since: datetime | None = Field(description="Since when it holds, where that's known")
    details: dict[str, int]


class DryingStatusRead(BaseModel):
    summary: DryingSummary
    alerts: list[DryingAlert]
