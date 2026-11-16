"""Attaching documents to claims: the photo upload flow, for paperwork.

1. :func:`start_upload` records what the client will send and returns a signed link.
2. The client uploads the file to that link: the bytes never pass through the API.
3. :func:`complete_upload` checks the stored file, and only then creates the document.

Reading needs ``claims:read``; attaching, editing and deleting need ``field_data:write``
and a claim that is not closed or cancelled.
"""

import logging
from pathlib import PurePosixPath
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from claimforge_api.auth.permissions import Permission, authorize
from claimforge_api.claims import service as claims
from claimforge_api.claims.schemas import ClaimActor
from claimforge_api.core.errors import BusinessRuleError, NotFoundError
from claimforge_api.core.ids import uuid7
from claimforge_api.db.pagination import Page, SortKey, paginate
from claimforge_api.documents.models import (
    VIEWABLE_TYPES,
    Document,
    DocumentType,
    DocumentUpload,
    storage_key,
)
from claimforge_api.documents.schemas import (
    DocumentListQuery,
    DocumentRead,
    DocumentUpdate,
    DocumentUploadCreate,
)
from claimforge_api.photos.service import VIEW_LINK_LIFETIME
from claimforge_api.storage.base import ObjectStorage, SignedUpload, StorageUnavailableError
from claimforge_api.uploads.service import UPLOAD_LINK_LIFETIME, check_received
from claimforge_api.users.models import User

logger = logging.getLogger(__name__)

NEWEST_FIRST = SortKey([Document.id], direction="desc")  # UUIDv7: creation order


class DocumentTooLargeError(BusinessRuleError):
    code = "document_too_large"
    title = "Document too large"


def default_title(filename: str) -> str:
    """``WA-1042 signed.pdf`` -> ``WA-1042 signed``; a name that is all extension stays."""
    # PurePosixPath: a Windows-style name is still one name, never a path.
    stem = PurePosixPath(filename.replace("\\", "/")).stem.strip()
    return (stem or filename)[:200]


def _documents(organization_id: UUID, claim_id: UUID) -> Select[Document]:
    return (
        select(Document)
        .where(Document.claim_id == claim_id, Document.organization_id == organization_id)
        .options(selectinload(Document.uploaded_by))
        .execution_options(populate_existing=True)
    )


async def _find_document(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, document_id: UUID
) -> Document | None:
    return await session.scalar(
        _documents(organization_id, claim_id).where(Document.id == document_id)
    )


async def _get_document(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, document_id: UUID
) -> Document:
    document = await _find_document(session, organization_id, claim_id, document_id)
    if document is None:
        raise NotFoundError("Document not found", document_id=str(document_id))
    return document


async def present(storage: ObjectStorage, document: Document) -> DocumentRead:
    """``document`` as clients see it, with fresh links to its file."""
    key = document.storage_key
    viewable = DocumentType(document.content_type) in VIEWABLE_TYPES
    return DocumentRead(
        id=document.id,
        claim_id=document.claim_id,
        title=document.title,
        category=document.category,
        filename=document.original_filename,
        content_type=document.content_type,
        size_bytes=document.size_bytes,
        uploaded_by=(
            ClaimActor.model_validate(document.uploaded_by) if document.uploaded_by else None
        ),
        created_at=document.created_at,
        updated_at=document.updated_at,
        download_url=await storage.download_url(
            key, expires_in=VIEW_LINK_LIFETIME, filename=document.original_filename
        ),
        view_url=(
            await storage.download_url(key, expires_in=VIEW_LINK_LIFETIME) if viewable else None
        ),
    )


async def list_documents(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    query: DocumentListQuery | None = None,
    *,
    user: User,
    limit: int,
    cursor: str | None,
) -> Page[Document]:
    """A claim's documents, newest first. Unfinished uploads aren't documents yet."""
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    await claims.require_live(session, organization_id, claim_id)
    statement = _documents(organization_id, claim_id)
    if query is not None and query.category:
        statement = statement.where(Document.category.in_(query.category))
    return await paginate(session, statement, NEWEST_FIRST, limit=limit, cursor=cursor)


async def get_document(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, document_id: UUID, *, user: User
) -> Document:
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    await claims.require_live(session, organization_id, claim_id)
    return await _get_document(session, organization_id, claim_id, document_id)


async def start_upload(
    session: AsyncSession,
    storage: ObjectStorage,
    organization_id: UUID,
    claim_id: UUID,
    data: DocumentUploadCreate,
    *,
    user: User,
    max_bytes: int,
) -> tuple[DocumentUpload, SignedUpload]:
    """Record the upload ``data`` describes and sign a link for its file."""
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    if data.size_bytes > max_bytes:
        raise DocumentTooLargeError(
            f"Documents can be at most {max_bytes} bytes", limit=max_bytes, size=data.size_bytes
        )
    upload_id = uuid7()
    key = storage_key(organization_id, claim_id, upload_id)
    signed = await storage.upload_url(
        key, content_type=data.content_type, expires_in=UPLOAD_LINK_LIFETIME
    )
    upload = DocumentUpload(
        id=upload_id,
        organization_id=organization_id,
        claim_id=claim_id,
        storage_key=key,
        original_filename=data.filename,
        content_type=data.content_type,
        size_bytes=data.size_bytes,
        title=data.title or default_title(data.filename),
        category=data.category,
        created_by_id=user.id,
        expires_at=signed.expires_at,
    )
    session.add(upload)
    await session.commit()
    return upload, signed


async def complete_upload(
    session: AsyncSession,
    storage: ObjectStorage,
    organization_id: UUID,
    claim_id: UUID,
    upload_id: UUID,
    *,
    user: User,
) -> tuple[Document, bool]:
    """The document for a finished upload, and whether this call created it.

    Completing again returns the same document, so clients can retry safely.
    """
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    done = await _find_document(session, organization_id, claim_id, upload_id)
    if done is not None:
        return done, False
    upload = await session.scalar(
        select(DocumentUpload).where(
            DocumentUpload.id == upload_id,
            DocumentUpload.claim_id == claim_id,
            DocumentUpload.organization_id == organization_id,
        )
    )
    if upload is None:
        raise NotFoundError("Upload not found", upload_id=str(upload_id))
    # str(): a plain string once loaded from the database (the column is a String).
    await check_received(storage, upload, str(upload.content_type))

    session.add(
        Document(
            id=upload.id,
            organization_id=organization_id,
            claim_id=claim_id,
            storage_key=upload.storage_key,
            original_filename=upload.original_filename,
            content_type=upload.content_type,
            size_bytes=upload.size_bytes,
            title=upload.title,
            category=upload.category,
            uploaded_by_id=upload.created_by_id,
        )
    )
    await session.delete(upload)
    await session.commit()
    return await _get_document(session, organization_id, claim_id, upload_id), True


async def update_document(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    document_id: UUID,
    data: DocumentUpdate,
    *,
    user: User,
) -> Document:
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    document = await _get_document(session, organization_id, claim_id, document_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(document, field, value)
    # Unchanged values leave no history, so a no-op writes neither a row nor an audit event.
    await session.commit()
    return await _get_document(session, organization_id, claim_id, document_id)


async def delete_document(
    session: AsyncSession,
    storage: ObjectStorage,
    organization_id: UUID,
    claim_id: UUID,
    document_id: UUID,
    *,
    user: User,
) -> None:
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    document = await _get_document(session, organization_id, claim_id, document_id)
    key = document.storage_key
    await session.delete(document)
    await session.commit()
    # After the commit: a file without a document is only wasted space; a document without
    # its file would be broken.
    try:
        await storage.delete(key)
    except StorageUnavailableError:
        logger.warning(
            "Document %s deleted but its file %s remains", document_id, key, exc_info=True
        )
