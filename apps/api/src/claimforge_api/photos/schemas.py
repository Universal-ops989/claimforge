"""Request and response schemas for claim photos."""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints

from claimforge_api.claims.schemas import ClaimActor
from claimforge_api.photos.models import PhotoType


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


class SignedUploadRead(BaseModel):
    """Send the file as the body of this request, with these headers."""

    url: str
    method: Literal["PUT"]
    headers: dict[str, str]
    expires_at: datetime


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
    created_at: datetime = Field(description="When the upload was completed")
    url: str = Field(
        description="Shows the photo; works for an hour. Fetch the photo again for a fresh one."
    )
    download_url: str = Field(description="Saves the photo under its file name; works for an hour.")
