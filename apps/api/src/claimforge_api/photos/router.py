"""HTTP endpoints for claim photos: start an upload, complete it, list, view and delete."""

from uuid import UUID

from fastapi import APIRouter, Response, status

from claimforge_api.api.deps import DbSession, PageParamsDep, SettingsDep, StorageDep
from claimforge_api.api.problems import PROBLEM_RESPONSES
from claimforge_api.auth.deps import CurrentUser
from claimforge_api.db.pagination import CursorPage
from claimforge_api.photos import service
from claimforge_api.photos.schemas import (
    PhotoRead,
    PhotoUploadCreate,
    PhotoUploadRead,
    SignedUploadRead,
)

router = APIRouter(
    prefix="/organizations/{organization_id}/claims/{claim_id}",
    tags=["photos"],
    responses=PROBLEM_RESPONSES,
)


@router.post(
    "/photo-uploads",
    status_code=status.HTTP_201_CREATED,
    summary="Start a photo upload",
    description="Needs `field_data:write`. Describe the file; the response holds a link to "
    "send it to, with the method and headers to use (the link works for 30 minutes). Then "
    "complete the upload. Photos larger than the limit are refused (`photo_too_large`, with "
    "`limit`). Closed and cancelled claims are read-only (`claim_locked`).",
)
async def start_photo_upload(
    organization_id: UUID,
    claim_id: UUID,
    session: DbSession,
    storage: StorageDep,
    settings: SettingsDep,
    user: CurrentUser,
    body: PhotoUploadCreate,
) -> PhotoUploadRead:
    upload, signed = await service.start_upload(
        session,
        storage,
        organization_id,
        claim_id,
        body,
        user=user,
        max_bytes=settings.photo_max_bytes,
    )
    return PhotoUploadRead(
        id=upload.id,
        upload=SignedUploadRead(
            url=signed.url,
            method=signed.method,
            headers=signed.headers,
            expires_at=signed.expires_at,
        ),
    )


@router.post(
    "/photo-uploads/{upload_id}/complete",
    status_code=status.HTTP_201_CREATED,
    summary="Complete a photo upload",
    description="Call once the file is sent. The stored file must match the size and type "
    "that were described: if it doesn't, it is deleted (`upload_mismatch`) and can be sent "
    "again. Not sent yet: `upload_not_received`. Completing an upload that is already a "
    "photo returns that photo with 200, so retries are safe.",
    responses={200: {"model": PhotoRead, "description": "Completed before: the same photo"}},
)
async def complete_photo_upload(
    organization_id: UUID,
    claim_id: UUID,
    upload_id: UUID,
    session: DbSession,
    storage: StorageDep,
    user: CurrentUser,
    response: Response,
) -> PhotoRead:
    photo, created = await service.complete_upload(
        session, storage, organization_id, claim_id, upload_id, user=user
    )
    if not created:
        response.status_code = status.HTTP_200_OK
    return await service.present(storage, photo)


@router.get(
    "/photos",
    summary="List a claim's photos",
    description="Newest first. Each photo's links work for an hour.",
)
async def list_photos(
    organization_id: UUID,
    claim_id: UUID,
    session: DbSession,
    storage: StorageDep,
    user: CurrentUser,
    page: PageParamsDep,
) -> CursorPage[PhotoRead]:
    result = await service.list_photos(
        session, organization_id, claim_id, user=user, limit=page.limit, cursor=page.cursor
    )
    return CursorPage[PhotoRead](
        items=[await service.present(storage, photo) for photo in result.items],
        next_cursor=result.next_cursor,
        has_more=result.has_more,
    )


@router.get("/photos/{photo_id}", summary="Get a photo, with fresh links")
async def get_photo(
    organization_id: UUID,
    claim_id: UUID,
    photo_id: UUID,
    session: DbSession,
    storage: StorageDep,
    user: CurrentUser,
) -> PhotoRead:
    photo = await service.get_photo(session, organization_id, claim_id, photo_id, user=user)
    return await service.present(storage, photo)


@router.delete(
    "/photos/{photo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a photo",
    description="Needs `field_data:write`. The file is deleted too.",
)
async def delete_photo(
    organization_id: UUID,
    claim_id: UUID,
    photo_id: UUID,
    session: DbSession,
    storage: StorageDep,
    user: CurrentUser,
) -> None:
    await service.delete_photo(session, storage, organization_id, claim_id, photo_id, user=user)
