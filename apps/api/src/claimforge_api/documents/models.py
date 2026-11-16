"""Documents, and the uploads that become them (the same flow as photos)."""

from enum import StrEnum
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from claimforge_api.db.base import Base
from claimforge_api.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin
from claimforge_api.uploads.models import ClaimFile, PendingUpload
from claimforge_api.users.models import User


class DocumentType(StrEnum):
    """What can be attached. Nothing a browser would run as a page (no HTML, no SVG)."""

    PDF = "application/pdf"
    DOC = "application/msword"
    DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    XLS = "application/vnd.ms-excel"
    XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    CSV = "text/csv"
    TEXT = "text/plain"
    EMAIL = "message/rfc822"  # a saved .eml
    # Scans and phone pictures of paper.
    JPEG = "image/jpeg"
    PNG = "image/png"
    WEBP = "image/webp"
    HEIC = "image/heic"


#: Types browsers show in a tab; everything else is only downloaded.
VIEWABLE_TYPES = frozenset(
    {DocumentType.PDF, DocumentType.TEXT, DocumentType.JPEG, DocumentType.PNG, DocumentType.WEBP}
)


class DocumentCategory(StrEnum):
    AUTHORIZATION = "authorization"  # work authorizations and other signed forms
    CORRESPONDENCE = "correspondence"
    ESTIMATE = "estimate"
    INVOICE = "invoice"
    POLICY = "policy"
    REPORT = "report"
    OTHER = "other"


def _in(column: str, values: type[StrEnum]) -> str:
    return f"{column} IN ({', '.join(sorted(repr(v.value) for v in values))})"


def storage_key(organization_id: UUID, claim_id: UUID, document_id: UUID) -> str:
    """Where a document's file lives. Ids only: nothing a user typed."""
    return f"organizations/{organization_id}/claims/{claim_id}/documents/{document_id}/file"


class _DocumentFile(ClaimFile):
    content_type: Mapped[DocumentType] = mapped_column(String(100))
    title: Mapped[str] = mapped_column(String(200))
    category: Mapped[DocumentCategory] = mapped_column(String(20))


def _checks() -> tuple[CheckConstraint, ...]:
    return (
        CheckConstraint(_in("content_type", DocumentType), name="content_type_valid"),
        CheckConstraint(_in("category", DocumentCategory), name="category_valid"),
        CheckConstraint("size_bytes > 0", name="size_positive"),
        CheckConstraint("btrim(title) <> ''", name="title_not_blank"),
    )


class DocumentUpload(_DocumentFile, PendingUpload, TimestampMixin, Base):
    __tablename__ = "document_uploads"

    __table_args__ = (
        *_checks(),
        Index("ix_document_uploads_claim_id", "claim_id"),
        # Finding abandoned uploads to discard.
        Index("ix_document_uploads_expires_at", "expires_at"),
    )


class Document(_DocumentFile, UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "documents"
    __audited__ = True

    uploaded_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )

    uploaded_by: Mapped[User | None] = relationship(lazy="raise")

    __table_args__ = (
        *_checks(),
        # A claim's documents, newest first (ids are time-ordered), by category or not.
        Index("ix_documents_claim_id_id", "claim_id", "id"),
    )
