"""Request and response schemas for contacts."""

from datetime import datetime
from typing import Annotated, Self
from uuid import UUID

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    EmailStr,
    StringConstraints,
    model_validator,
)

from claimforge_api.contacts.models import ContactKind, ContactMethod
from claimforge_api.core.phones import normalize_phone


def _blank_to_none(value: object) -> object:
    """Forms send "" for an empty optional field; treat it as "no value"."""
    return None if isinstance(value, str) and not value.strip() else value


Blankable = BeforeValidator(_blank_to_none)
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Email = Annotated[EmailStr, StringConstraints(max_length=254), AfterValidator(str.lower)]
Phone = Annotated[str, StringConstraints(max_length=40), AfterValidator(normalize_phone)]
Notes = Annotated[str, StringConstraints(strip_whitespace=True, max_length=4000)]


class ContactCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: ContactKind = ContactKind.POLICYHOLDER
    full_name: Name
    company_name: Annotated[Name | None, Blankable] = None
    email: Annotated[Email | None, Blankable] = None
    phone: Annotated[Phone | None, Blankable] = None
    preferred_contact_method: ContactMethod | None = None
    notes: Annotated[Notes | None, Blankable] = None


class ContactUpdate(BaseModel):
    """Partial update: omitted fields are unchanged, ``null`` (or "") clears optional ones."""

    model_config = ConfigDict(extra="forbid")

    kind: ContactKind | None = None
    full_name: Name | None = None
    company_name: Annotated[Name | None, Blankable] = None
    email: Annotated[Email | None, Blankable] = None
    phone: Annotated[Phone | None, Blankable] = None
    preferred_contact_method: ContactMethod | None = None
    notes: Annotated[Notes | None, Blankable] = None

    @model_validator(mode="after")
    def _required_fields_stay_set(self) -> Self:
        for field in ("kind", "full_name"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be cleared")
        return self


class ContactRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kind: ContactKind
    full_name: str
    company_name: str | None
    email: str | None
    phone: str | None
    preferred_contact_method: ContactMethod | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
