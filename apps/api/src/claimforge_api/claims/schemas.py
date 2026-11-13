"""Request and response schemas for claims."""

from datetime import date, datetime
from enum import StrEnum
from typing import Annotated, Self
from uuid import UUID

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StringConstraints,
    computed_field,
    model_validator,
)

from claimforge_api.claims import workflow
from claimforge_api.claims.models import AssignmentRole, ClaimContactRole, ClaimStatus, LossType
from claimforge_api.contacts.schemas import ContactRead
from claimforge_api.properties.schemas import PropertyCreate, PropertyRead

MAX_CONTACTS = 20


def _blank_to_none(value: object) -> object:
    return None if isinstance(value, str) and not value.strip() else value


Blankable = BeforeValidator(_blank_to_none)
Description = Annotated[
    Annotated[str, StringConstraints(strip_whitespace=True, max_length=10_000)] | None, Blankable
]
CarrierName = Annotated[
    Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] | None, Blankable
]
CarrierReference = Annotated[
    Annotated[str, StringConstraints(strip_whitespace=True, max_length=64)] | None, Blankable
]


class ClaimContactLink(BaseModel):
    model_config = ConfigDict(extra="forbid")

    contact_id: UUID
    role: ClaimContactRole
    is_primary: bool = False


class ClaimContactLinkUpdate(BaseModel):
    """Change a contact's role on a claim, or whether they are the primary contact.

    Promoting a contact to primary demotes the previous primary contact.
    """

    model_config = ConfigDict(extra="forbid")

    role: ClaimContactRole | None = None
    is_primary: bool | None = None

    @model_validator(mode="after")
    def _something_to_change(self) -> Self:
        if self.role is None and self.is_primary is None:
            raise ValueError("Give a role, is_primary, or both")
        return self


class ClaimCreate(BaseModel):
    """Give either ``property_id`` or an inline ``property``.

    An inline property at an address the organization already has reuses that property.
    """

    model_config = ConfigDict(extra="forbid")

    property_id: UUID | None = None
    property: PropertyCreate | None = None
    loss_type: LossType
    loss_date: date | None = None
    description: Description = None
    carrier_name: CarrierName = None
    carrier_claim_number: CarrierReference = None
    policy_number: CarrierReference = None
    contacts: list[ClaimContactLink] = Field(default_factory=list, max_length=MAX_CONTACTS)

    @model_validator(mode="after")
    def _consistent(self) -> Self:
        if (self.property_id is None) == (self.property is None):
            raise ValueError("Give exactly one of property_id or property")
        contact_ids = [c.contact_id for c in self.contacts]
        if len(set(contact_ids)) != len(contact_ids):
            raise ValueError("Each contact can be linked to a claim only once")
        if sum(c.is_primary for c in self.contacts) > 1:
            raise ValueError("Only one contact can be primary")
        return self


class ClaimUpdate(BaseModel):
    """Partial update: omitted fields are unchanged, ``null`` (or "") clears optional ones.

    The number never changes; status, property and contacts have their own operations.
    """

    model_config = ConfigDict(extra="forbid")

    loss_type: LossType | None = None
    loss_date: date | None = None
    description: Description = None
    carrier_name: CarrierName = None
    carrier_claim_number: CarrierReference = None
    policy_number: CarrierReference = None

    @model_validator(mode="after")
    def _loss_type_stays_set(self) -> Self:
        if "loss_type" in self.model_fields_set and self.loss_type is None:
            raise ValueError("loss_type cannot be cleared")
        return self


class ClaimActor(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str


class ClaimAssignmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user: ClaimActor
    role: AssignmentRole
    assigned_by_id: UUID | None
    assigned_at: datetime = Field(validation_alias="created_at")


class ClaimContactRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    contact: ContactRead
    role: ClaimContactRole
    is_primary: bool


class ClaimRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    number: str = Field(description='Unique per organization, e.g. "2026-00042"')
    status: ClaimStatus
    loss_type: LossType
    loss_date: date | None
    description: str | None
    carrier_name: str | None
    carrier_claim_number: str | None
    policy_number: str | None
    property: PropertyRead
    contacts: list[ClaimContactRead]
    assignments: list[ClaimAssignmentRead]
    created_by_id: UUID | None
    created_at: datetime
    updated_at: datetime

    # A plain method: `property` is a field name here, so the decorator would be shadowed.
    @computed_field(
        description="Statuses the workflow allows next. Leaving `closed` or `cancelled` "
        "also needs the `claims:reopen` permission."
    )
    def next_statuses(self) -> list[ClaimStatus]:
        return workflow.next_statuses(self.status)


class ClaimSort(StrEnum):
    """Sort orders for the claim list. A leading "-" means newest/latest first."""

    NEWEST = "-created_at"
    OLDEST = "created_at"
    RECENTLY_UPDATED = "-updated_at"
    LOSS_DATE_DESC = "-loss_date"
    LOSS_DATE_ASC = "loss_date"


class ClaimListQuery(BaseModel):
    """Filters for the claim list. Every filter given must match."""

    status: list[ClaimStatus] = Field(
        default_factory=list, description="Any of these statuses; repeat to give several"
    )
    loss_type: list[LossType] = Field(
        default_factory=list, description="Any of these loss types; repeat to give several"
    )
    property_id: UUID | None = None
    contact_id: UUID | None = Field(
        default=None, description="Claims this contact is linked to, in any role"
    )
    assigned_to: UUID | None = Field(
        default=None, description="Claims this member is assigned to, in any role"
    )
    has_adjuster: bool | None = Field(default=None, description="`false`: claims nobody owns yet")
    loss_date_from: date | None = Field(default=None, description="Inclusive")
    loss_date_to: date | None = Field(default=None, description="Inclusive")
    q: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] | None = Field(
        default=None,
        description="Matches the claim number, carrier name, carrier claim number, policy "
        "number, the property's street, city or postal code, or a linked contact's name",
    )
    sort: ClaimSort = Field(
        default=ClaimSort.NEWEST,
        description="Claims with no loss date come last for `loss_date` and first for `-loss_date`",
    )

    @model_validator(mode="after")
    def _ordered_range(self) -> Self:
        if self.loss_date_from and self.loss_date_to and self.loss_date_from > self.loss_date_to:
            raise ValueError("loss_date_from must not be after loss_date_to")
        return self


class ClaimSummary(BaseModel):
    """A claim as the list shows it: the property, the person to call first and who owns it."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    number: str
    status: ClaimStatus
    loss_type: LossType
    loss_date: date | None
    carrier_name: str | None
    carrier_claim_number: str | None
    policy_number: str | None
    property: PropertyRead
    primary_contact: ClaimContactRead | None
    adjuster: ClaimActor | None
    created_at: datetime
    updated_at: datetime


Reason = Annotated[
    Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] | None, Blankable
]


class ClaimStatusChangeCreate(BaseModel):
    """Move a claim to another status (see ``claims.workflow`` for the allowed moves)."""

    model_config = ConfigDict(extra="forbid")

    status: ClaimStatus
    reason: Reason = Field(
        default=None,
        description="Required to put a claim on hold, cancel it, or reopen or reinstate it",
    )
    expected_status: ClaimStatus | None = Field(
        default=None,
        description="The status the client last saw. If the claim has moved on since, the "
        "change is refused with 409 `status_changed` instead of acting on a stale view.",
    )


class ClaimStatusChangeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    from_status: ClaimStatus
    to_status: ClaimStatus
    reason: str | None
    changed_by: ClaimActor | None = Field(description="None once the user is deleted")
    changed_at: datetime


class ClaimAssignmentCreate(BaseModel):
    """Assign a member to a claim. Assigning an adjuster replaces the current one."""

    model_config = ConfigDict(extra="forbid")

    user_id: UUID
    role: AssignmentRole
