"""Request and response schemas for claim documents."""

from datetime import datetime
from typing import Annotated, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from claimforge_api.claims.schemas import ClaimActor
from claimforge_api.documents.models import DocumentCategory, DocumentType
from claimforge_api.uploads.schemas import SignedUploadRead

Title = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=200),
    Field(examples=["Signed work authorization"]),
]


class DocumentUploadCreate(BaseModel):
    """What the client is about to upload. The stored file must match it."""

    model_config = ConfigDict(extra="forbid")

    filename: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)
    ] = Field(description="The file's name; downloads use it.", examples=["WA-1042 signed.pdf"])
    content_type: DocumentType
    size_bytes: int = Field(gt=0, description="Exact size of the file in bytes.")
    title: Title | None = Field(
        default=None, description="Defaults to the file name without its extension."
    )
    category: DocumentCategory = DocumentCategory.OTHER


class DocumentUploadRead(BaseModel):
    id: UUID = Field(description="Also the id of the document once the upload is completed.")
    upload: SignedUploadRead


class DocumentUpdate(BaseModel):
    """Only the fields sent change."""

    model_config = ConfigDict(extra="forbid")

    title: Title | None = None
    category: DocumentCategory | None = None

    @model_validator(mode="after")
    def _not_null(self) -> Self:
        for field in ("title", "category"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class DocumentListQuery(BaseModel):
    category: list[DocumentCategory] = Field(
        default_factory=list, description="Only these categories; repeat for several."
    )


class DocumentRead(BaseModel):
    id: UUID
    claim_id: UUID
    title: str
    category: DocumentCategory
    filename: str
    content_type: DocumentType
    size_bytes: int
    uploaded_by: ClaimActor | None = Field(description="Null once the account is gone")
    created_at: datetime = Field(description="When the upload was completed")
    updated_at: datetime
    download_url: str = Field(description="Saves the file under its name; works for an hour.")
    view_url: str | None = Field(
        description="Opens PDFs, text and images in the browser; works for an hour. Null for "
        "types browsers can't show (Word, Excel, CSV, email): use `download_url`."
    )
