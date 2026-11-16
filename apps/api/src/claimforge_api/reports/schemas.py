"""Request and response schemas for report templates."""

from datetime import datetime
from typing import Annotated, Any, Literal, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from claimforge_api.claims.schemas import ClaimActor
from claimforge_api.reports.models import DEFAULT_ACCENT, JobStatus, ReportKind


class PhotoReportOptions(BaseModel):
    model_config = ConfigDict(extra="forbid")

    photos_per_page: Literal[1, 2, 4, 6] = 2
    show_captions: bool = True
    show_tags: bool = False
    show_taken_at: bool = True
    group_by_room: bool = True


class DryingReportOptions(BaseModel):
    model_config = ConfigDict(extra="forbid")

    include_atmosphere: bool = True
    include_equipment: bool = True
    include_alerts: bool = True


#: Each kind's options, with their defaults: what a template without options gets.
OPTIONS: dict[ReportKind, type[PhotoReportOptions] | type[DryingReportOptions]] = {
    ReportKind.PHOTO: PhotoReportOptions,
    ReportKind.DRYING: DryingReportOptions,
}
#: The cover title of a template that doesn't set one.
TITLES = {ReportKind.PHOTO: "Photo Report", ReportKind.DRYING: "Drying Report"}


def options_for(kind: ReportKind, given: dict[str, Any] | None) -> dict[str, Any]:
    """``given`` checked against ``kind``'s options, defaults filled in."""
    return OPTIONS[kind].model_validate(given or {}).model_dump()


Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Title = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] | None
Text = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None
Color = Annotated[
    str,
    StringConstraints(strip_whitespace=True, pattern=r"^#[0-9A-Fa-f]{6}$"),
    Field(examples=[DEFAULT_ACCENT]),
]
OptionsIn = Field(
    default=None,
    description="Checked against the kind. Photo reports: `photos_per_page` (1, 2, 4 or 6), "
    "`show_captions`, `show_tags`, `show_taken_at`, `group_by_room`. Drying reports: "
    "`include_atmosphere`, `include_equipment`, `include_alerts`. Left out: the defaults.",
)


class TemplateCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: ReportKind
    name: Name
    title: Title = None
    header_text: Text = None
    footer_text: Text = None
    accent_color: Color = DEFAULT_ACCENT
    options: dict[str, Any] | None = OptionsIn
    is_default: bool = Field(default=False, description="Takes over from the kind's default")

    @model_validator(mode="after")
    def _options_fit_the_kind(self) -> Self:
        self.options = options_for(self.kind, self.options)
        return self


class TemplateUpdate(BaseModel):
    """Only the fields sent change; ``options`` replaces them all. The kind is fixed."""

    model_config = ConfigDict(extra="forbid")

    name: Name | None = None
    title: Title = None
    header_text: Text = None
    footer_text: Text = None
    accent_color: Color | None = None
    options: dict[str, Any] | None = OptionsIn
    is_default: bool | None = None

    @model_validator(mode="after")
    def _required_stay(self) -> Self:
        for field in ("name", "accent_color", "is_default"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class TemplateRead(BaseModel):
    id: UUID | None = Field(description="Null for the built-in default")
    kind: ReportKind
    name: str
    title: str = Field(description="The cover title (the kind's own when not set)")
    header_text: str | None
    footer_text: str | None
    accent_color: str
    options: PhotoReportOptions | DryingReportOptions
    is_default: bool
    logo_url: str | None = Field(description="The logo, a PNG; works for an hour")
    built_in: bool = Field(description="True: no template is set up, this is what's used")
    created_at: datetime | None
    updated_at: datetime | None


class ReportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: ReportKind


class ReportJobRead(BaseModel):
    id: UUID
    claim_id: UUID
    kind: ReportKind
    status: JobStatus = Field(description="`queued` until it's `ready` or `failed`")
    requested_by: ClaimActor | None
    created_at: datetime
    finished_at: datetime | None
    size_bytes: int | None
    error: str | None = Field(description="Why it failed, or the last retry's reason")
    download_url: str | None = Field(
        description="Ready reports: saves the PDF under a readable name; works for an hour"
    )
