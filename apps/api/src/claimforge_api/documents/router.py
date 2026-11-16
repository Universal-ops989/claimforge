"""HTTP endpoints for claim documents: attach, complete, list, view, edit and delete."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Response, status

from claimforge_api.api.deps import DbSession, PageParamsDep, SettingsDep, StorageDep
from claimforge_api.api.problems import PROBLEM_RESPONSES
from claimforge_api.auth.deps import CurrentUser
from claimforge_api.db.pagination import CursorPage
from claimforge_api.documents import service
from claimforge_api.documents.schemas import (
    DocumentListQuery,
    DocumentRead,
    DocumentUpdate,
    DocumentUploadCreate,
    DocumentUploadRead,
)
from claimforge_api.uploads.schemas import SignedUploadRead

router = APIRouter(
    prefix="/organizations/{organization_id}/claims/{claim_id}",
    tags=["documents"],
    responses=PROBLEM_RESPONSES,
)


@router.post(
    "/document-uploads",
    status_code=status.HTTP_201_CREATED,
    summary="Start attaching a document",
    description="Needs `field_data:write`. Describe the file; the response holds a link to "
    "send it to, with the method and headers to use (the link works for 30 minutes). Then "
    "complete the upload. The title defaults to the file name without its extension. Files "
    "larger than the limit are refused (`document_too_large`, with `limit`). Closed and "
    "cancelled claims are read-only (`claim_locked`).",
)
async def start_document_upload(
    organization_id: UUID,
    claim_id: UUID,
    session: DbSession,
    storage: StorageDep,
    settings: SettingsDep,
    user: CurrentUser,
    body: DocumentUploadCreate,
) -> DocumentUploadRead:
    upload, signed = await service.start_upload(
        session,
        storage,
        organization_id,
        claim_id,
        body,
        user=user,
        max_bytes=settings.document_max_bytes,
    )
    return DocumentUploadRead(id=upload.id, upload=SignedUploadRead.of(signed))


@router.post(
    "/document-uploads/{upload_id}/complete",
    status_code=status.HTTP_201_CREATED,
    summary="Complete attaching a document",
    description="Call once the file is sent. The stored file must match the size and type "
    "that were described: if it doesn't, it is deleted (`upload_mismatch`) and can be sent "
    "again. Not sent yet: `upload_not_received`. Completing an upload that is already a "
    "document returns that document with 200, so retries are safe.",
    responses={200: {"model": DocumentRead, "description": "Completed before: the same one"}},
)
async def complete_document_upload(
    organization_id: UUID,
    claim_id: UUID,
    upload_id: UUID,
    session: DbSession,
    storage: StorageDep,
    user: CurrentUser,
    response: Response,
) -> DocumentRead:
    document, created = await service.complete_upload(
        session, storage, organization_id, claim_id, upload_id, user=user
    )
    if not created:
        response.status_code = status.HTTP_200_OK
    return await service.present(storage, document)


@router.get(
    "/documents",
    summary="List a claim's documents",
    description="Newest first. Each document's links work for an hour. Filter by category: "
    "`category=estimate&category=invoice` finds either.",
)
async def list_documents(
    organization_id: UUID,
    claim_id: UUID,
    session: DbSession,
    storage: StorageDep,
    user: CurrentUser,
    page: PageParamsDep,
    query: Annotated[DocumentListQuery, Query()],
) -> CursorPage[DocumentRead]:
    result = await service.list_documents(
        session,
        organization_id,
        claim_id,
        query,
        user=user,
        limit=page.limit,
        cursor=page.cursor,
    )
    return CursorPage[DocumentRead](
        items=[await service.present(storage, document) for document in result.items],
        next_cursor=result.next_cursor,
        has_more=result.has_more,
    )


@router.get("/documents/{document_id}", summary="Get a document, with fresh links")
async def get_document(
    organization_id: UUID,
    claim_id: UUID,
    document_id: UUID,
    session: DbSession,
    storage: StorageDep,
    user: CurrentUser,
) -> DocumentRead:
    document = await service.get_document(
        session, organization_id, claim_id, document_id, user=user
    )
    return await service.present(storage, document)


@router.patch(
    "/documents/{document_id}",
    summary="Rename or recategorize a document",
    description="Needs `field_data:write`. Only the fields sent change; neither can be null.",
)
async def update_document(
    organization_id: UUID,
    claim_id: UUID,
    document_id: UUID,
    session: DbSession,
    storage: StorageDep,
    user: CurrentUser,
    body: DocumentUpdate,
) -> DocumentRead:
    document = await service.update_document(
        session, organization_id, claim_id, document_id, body, user=user
    )
    return await service.present(storage, document)


@router.delete(
    "/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a document",
    description="Needs `field_data:write`. The file is deleted too.",
)
async def delete_document(
    organization_id: UUID,
    claim_id: UUID,
    document_id: UUID,
    session: DbSession,
    storage: StorageDep,
    user: CurrentUser,
) -> None:
    await service.delete_document(
        session, storage, organization_id, claim_id, document_id, user=user
    )
