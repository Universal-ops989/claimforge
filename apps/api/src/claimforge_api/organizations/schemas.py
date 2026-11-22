"""Request and response schemas for organizations."""

from datetime import datetime
from typing import Annotated
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints

from claimforge_api.auth.permissions import Permission
from claimforge_api.organizations.models import SLUG_PATTERN
from claimforge_api.pricing.schemas import Percent
from claimforge_api.users.models import Role


def _valid_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise ValueError(
            f"Unknown time zone '{value}'. Use an IANA name like America/Chicago."
        ) from exc
    return value


Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Slug = Annotated[str, StringConstraints(pattern=SLUG_PATTERN, max_length=63)]
TimeZone = Annotated[str, AfterValidator(_valid_timezone)]


class OrganizationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Name
    slug: Slug | None = Field(default=None, description="Derived from the name when omitted")
    timezone: TimeZone = "UTC"


class OrganizationUpdate(BaseModel):
    """Partial update; omitted fields are unchanged. The slug is immutable to keep URLs stable."""

    model_config = ConfigDict(extra="forbid")

    name: Name | None = None
    timezone: TimeZone | None = None
    default_tax_percent: Percent | None = Field(
        default=None, description="Sales tax new estimates start with"
    )
    default_overhead_percent: Percent | None = None
    default_profit_percent: Percent | None = None


class OrganizationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str
    timezone: str
    default_tax_percent: Percent
    default_overhead_percent: Percent
    default_profit_percent: Percent
    created_at: datetime
    updated_at: datetime


class MemberPerson(BaseModel):
    """Who a member is, as teammates see them: never an email or anything else personal."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str


class MemberUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Role


class MemberRead(BaseModel):
    """One member of an organization: who, their role, and what that role allows."""

    user: MemberPerson
    role: Role
    permissions: list[Permission] = Field(
        description="What the role allows, so a client can tell who can be given which work"
    )
    joined_at: datetime
