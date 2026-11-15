"""The local backend's signed URLs: clients upload and download here with them.

These routes take no bearer token; the signature is the permission. They are left out of
the OpenAPI document because clients only ever follow URLs the API handed them, and they
answer 404 when another backend is configured.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response, status

from claimforge_api.api.deps import SettingsDep, StorageDep
from claimforge_api.core.errors import AppError, NotFoundError, PermissionDeniedError
from claimforge_api.storage.base import (
    InvalidKeyError,
    ObjectNotFoundError,
    check_content_type,
    check_key,
    content_disposition,
)
from claimforge_api.storage.local import LocalStorage, SignatureCheck

router = APIRouter(prefix="/storage", tags=["storage"], include_in_schema=False)


class InvalidSignatureError(PermissionDeniedError):
    code = "invalid_signature"
    title = "This link is not valid"


class SignatureExpiredError(PermissionDeniedError):
    code = "signature_expired"
    title = "This link has expired"


class UploadTooLargeError(AppError):
    status = 413
    code = "upload_too_large"
    title = "Upload too large"


def _local_storage(storage: StorageDep) -> LocalStorage:
    if not isinstance(storage, LocalStorage):
        raise NotFoundError()
    return storage


LocalStorageDep = Annotated[LocalStorage, Depends(_local_storage)]
Expires = Annotated[int, Query(description="Unix time the link stops working")]
Signature = Annotated[str, Query(max_length=128)]


def _object_key(key: str) -> str:
    try:
        return check_key(key)
    except InvalidKeyError:
        raise NotFoundError() from None


def _check(
    storage: LocalStorage, method: str, key: str, expires: int, signature: str, detail: str
) -> None:
    match storage.check_signature(method, key, expires=expires, signature=signature, detail=detail):
        case SignatureCheck.INVALID:
            raise InvalidSignatureError()
        case SignatureCheck.EXPIRED:
            raise SignatureExpiredError()


async def _read_body(request: Request, limit: int) -> bytes:
    declared = request.headers.get("content-length")
    if declared is not None and declared.isdigit() and int(declared) > limit:
        raise UploadTooLargeError(limit=limit)
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > limit:
            raise UploadTooLargeError(limit=limit)
    return bytes(body)


@router.put("/{key:path}", status_code=status.HTTP_204_NO_CONTENT)
async def upload_object(
    key: str,
    expires: Expires,
    signature: Signature,
    request: Request,
    storage: LocalStorageDep,
    settings: SettingsDep,
) -> Response:
    key = _object_key(key)
    # Like S3: the Content-Type is part of what was signed, so a mismatch is a bad link.
    try:
        content_type = check_content_type(request.headers.get("content-type", ""))
    except ValueError:
        raise InvalidSignatureError() from None
    _check(storage, "PUT", key, expires, signature, content_type)
    body = await _read_body(request, settings.storage_max_upload_bytes)
    await storage.put(key, body, content_type=content_type)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{key:path}")
async def download_object(
    key: str,
    expires: Expires,
    signature: Signature,
    storage: LocalStorageDep,
    filename: Annotated[str | None, Query(max_length=255)] = None,
) -> Response:
    key = _object_key(key)
    _check(storage, "GET", key, expires, signature, filename or "")
    try:
        info, data = await storage.read(key)
    except ObjectNotFoundError:
        raise NotFoundError() from None
    return Response(
        content=data,
        media_type=info.content_type,
        headers={
            "Content-Disposition": content_disposition(filename),
            # The link is the secret: shared caches must not keep a copy.
            "Cache-Control": f"private, max-age={storage.seconds_left(expires)}",
            # Uploaded files are served from the API's origin: never as runnable pages.
            "Content-Security-Policy": "sandbox",
            "X-Content-Type-Options": "nosniff",
        },
    )
