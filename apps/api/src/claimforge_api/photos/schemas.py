"""Request and response schemas for claim photos."""

from datetime import datetime
from typing import Annotated, Self
from uuid import UUID

from pydantic import (
    AfterValidator,
    AwareDatetime,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StringConstraints,
    model_validator,
)

from claimforge_api.claims.schemas import ClaimActor
from claimforge_api.photos.models import PhotoType, ProcessingStatus
from claimforge_api.uploads.schemas import SignedUploadRead

MAX_TAGS = 20


def _normalize_tag(value: object) -> object:
    # "  Water   Damage " and "water damage" are one tag.
    return " ".join(value.split()).lower() if isinstance(value, str) else value


Tag = Annotated[
    str,
    BeforeValidator(_normalize_tag),
    StringConstraints(min_length=1, max_length=40, pattern=r"^\w[\w -]*$"),
    Field(examples=["before"]),
]
Tags = Annotated[
    list[Tag],
    Field(
        max_length=MAX_TAGS,
        description=f"Short labels, at most {MAX_TAGS}: letters, digits, spaces and hyphens. "
        "Stored lowercase, without repeats, in alphabetical order.",
        examples=[["before", "ceiling"]],
    ),
    AfterValidator(lambda tags: sorted(set(tags))),
]


def _blank_is_none(value: str | None) -> str | None:
    return value or None


Caption = Annotated[
    Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None,
    AfterValidator(_blank_is_none),
    Field(description="Free text. Blank clears it.", examples=["Stain spreading from the vent"]),
]


class PhotoUploadCreate(BaseModel):
    """What the client is about to upload. The stored file must match it."""

    model_config = ConfigDict(extra="forbid")

    filename: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)
    ] = Field(
        description="The file's name on the device; downloads use it.", examples=["IMG_0412.HEIC"]
    )
    content_type: PhotoType
    size_bytes: int = Field(gt=0, description="Exact size of the file in bytes.")
    taken_at: AwareDatetime | None = Field(
        default=None, description="When the picture was taken, from the photo's metadata."
    )
    caption: Caption = None
    tags: Tags = Field(default_factory=list)
    room_id: UUID | None = Field(default=None, description="A room of this claim.")


class PhotoUpdate(BaseModel):
    """Only the fields sent change. ``room_id: null`` takes the photo out of its room."""

    model_config = ConfigDict(extra="forbid")

    caption: Caption = None
    tags: Tags | None = None
    room_id: UUID | None = None

    @model_validator(mode="after")
    def _tags_not_null(self) -> Self:
        if "tags" in self.model_fields_set and self.tags is None:
            raise ValueError("tags cannot be null; send [] to remove them all")
        return self


class PhotoListQuery(BaseModel):
    room_id: UUID | None = Field(default=None, description="Only this room's photos")
    unassigned: bool = Field(default=False, description="Only photos not linked to a room")
    tag: list[Tag] = Field(
        default_factory=list, description="Only photos with every one of these tags; repeat."
    )

    @model_validator(mode="after")
    def _one_room_filter(self) -> Self:
        if self.unassigned and self.room_id is not None:
            raise ValueError("Filter by room_id or unassigned, not both")
        return self


class PhotoRoom(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class TagCount(BaseModel):
    tag: str
    photos: int = Field(description="How many photos on live claims carry it")


class PhotoUploadRead(BaseModel):
    id: UUID = Field(description="Also the id of the photo once the upload is completed.")
    upload: SignedUploadRead


class PhotoRead(BaseModel):
    id: UUID
    claim_id: UUID
    filename: str
    content_type: PhotoType
    size_bytes: int
    taken_at: datetime | None
    uploaded_by: ClaimActor | None = Field(description="Null once the account is gone")
    caption: str | None
    tags: list[str]
    room: PhotoRoom | None
    created_at: datetime = Field(description="When the upload was completed")
    url: str = Field(
        description="Shows the photo; works for an hour. Fetch the photo again for a fresh one."
    )
    download_url: str = Field(description="Saves the photo under its file name; works for an hour.")
    processing: ProcessingStatus = Field(
        description="Thumbnails are made in the background: `pending` until then, `failed` "
        "when the file can't be read (the original can still be downloaded)."
    )
    width: int | None = Field(description="Of the original, upright; once processed.")
    height: int | None
    thumbnail_url: str | None = Field(
        description="A JPEG at most 400 px on its longest side, once processed."
    )
    preview_url: str | None = Field(
        description="A JPEG at most 1600 px on its longest side, once processed. Show this "
        "rather than `url`: most browsers can't display HEIC originals."
    )
