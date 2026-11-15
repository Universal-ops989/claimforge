"""Files on local disk, for development and single-server installs.

Objects live under ``<root>/objects/<key>`` and their content types under
``<root>/types/<key>``. Writes go to a temporary file first and are renamed into place, so
readers never see half an object. Signed URLs point at the API's own ``/v1/storage`` routes,
which check them with :meth:`LocalStorage.check_signature`.

Keys are built by the server (ids, not user-supplied names): on case-insensitive file
systems ``a`` and ``A`` are the same file, and a key can't be both an object and a prefix
(``a`` and ``a/b``).
"""

import asyncio
import contextlib
import math
import os
import time
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from pathlib import Path
from urllib.parse import quote, urlencode
from uuid import uuid4

from claimforge_api.storage.base import (
    ObjectInfo,
    ObjectNotFoundError,
    SignedUpload,
    StorageUnavailableError,
    check_content_type,
    check_key,
    check_lifetime,
)
from claimforge_api.storage.signing import UrlSigner

#: Served when an object's type file is missing (written by hand, or an interrupted put).
DEFAULT_CONTENT_TYPE = "application/octet-stream"
#: The prefix that lifts Windows' 260-character limit on paths.
EXTENDED_PREFIX = "\\\\?\\"
#: Path of the signed-URL routes, under the API's public URL.
URL_PATH = "/v1/storage/"


class SignatureCheck(StrEnum):
    """Why a signed URL was refused, if it was."""

    VALID = "valid"
    INVALID = "invalid"
    EXPIRED = "expired"


class LocalStorage:
    def __init__(
        self,
        root: Path,
        *,
        signer: UrlSigner,
        base_url: str,
        clock: Callable[[], float] = time.time,
    ) -> None:
        root = _without_length_limit(root)
        self._objects = root / "objects"
        self._types = root / "types"
        self._signer = signer
        self._base_url = base_url.rstrip("/")
        self._clock = clock

    def _paths(self, key: str) -> tuple[Path, Path]:
        parts = check_key(key).split("/")
        return self._objects.joinpath(*parts), self._types.joinpath(*parts)

    # Reading and writing

    async def put(self, key: str, data: bytes, *, content_type: str) -> ObjectInfo:
        content_type = check_content_type(content_type)
        obj, kind = self._paths(key)

        def write() -> None:
            # Type first: once the object is in place, its type is too.
            _write_atomically(kind, content_type.encode("utf-8"))
            _write_atomically(obj, data)

        await _in_thread(write)
        return ObjectInfo(key=key, size=len(data), content_type=content_type)

    async def read(self, key: str) -> tuple[ObjectInfo, bytes]:
        """The object and its details, in one go (what the download route serves)."""
        obj, kind = self._paths(key)

        def load() -> tuple[ObjectInfo, bytes]:
            # A directory is a prefix of other keys, not an object.
            if not obj.is_file():
                raise ObjectNotFoundError(key)
            try:
                data = obj.read_bytes()
            except FileNotFoundError:  # deleted since the check
                raise ObjectNotFoundError(key) from None
            return ObjectInfo(key=key, size=len(data), content_type=_read_type(kind)), data

        return await _in_thread(load)

    async def get(self, key: str) -> bytes:
        _, data = await self.read(key)
        return data

    async def stat(self, key: str) -> ObjectInfo | None:
        obj, kind = self._paths(key)

        def look() -> ObjectInfo | None:
            if not obj.is_file():
                return None
            try:
                size = obj.stat().st_size
            except FileNotFoundError:
                return None
            return ObjectInfo(key=key, size=size, content_type=_read_type(kind))

        return await _in_thread(look)

    async def delete(self, key: str) -> None:
        obj, kind = self._paths(key)

        def remove() -> None:
            for path, top in ((obj, self._objects), (kind, self._types)):
                with contextlib.suppress(FileNotFoundError, NotADirectoryError):
                    path.unlink()
                _prune_empty_parents(path, top)

        await _in_thread(remove)

    # Setup and health

    async def ping(self) -> None:
        def check() -> None:
            for directory in (self._objects, self._types):
                directory.mkdir(parents=True, exist_ok=True)
                if not os.access(directory, os.W_OK):
                    raise StorageUnavailableError(f"{directory} is not writable")

        await _in_thread(check)

    async def prepare(self, *, cors_origins: list[str]) -> None:
        # Signed URLs are served by the API, whose CORS settings already apply.
        await self.ping()

    # Signed URLs

    async def upload_url(
        self, key: str, *, content_type: str, expires_in: timedelta
    ) -> SignedUpload:
        content_type = check_content_type(content_type)
        expires = self._expiry(expires_in)
        signature = self._signer.sign("PUT", check_key(key), str(expires), content_type)
        return SignedUpload(
            url=self._url(key, {"expires": expires, "signature": signature}),
            method="PUT",
            headers={"Content-Type": content_type},
            expires_at=datetime.fromtimestamp(expires, UTC),
        )

    async def download_url(
        self, key: str, *, expires_in: timedelta, filename: str | None = None
    ) -> str:
        expires = self._expiry(expires_in)
        signature = self._signer.sign("GET", check_key(key), str(expires), filename or "")
        query: dict[str, str | int] = {"expires": expires, "signature": signature}
        if filename:
            query["filename"] = filename
        return self._url(key, query)

    def check_signature(
        self, method: str, key: str, *, expires: int, signature: str, detail: str
    ) -> SignatureCheck:
        """A :class:`SignatureCheck` for a request to a URL this storage signed.

        ``detail`` is what the URL was bound to besides the key: the content type of an
        upload, the file name of a download.
        """
        if not self._signer.verify(signature, method, key, str(expires), detail):
            return SignatureCheck.INVALID
        if expires < self._clock():
            return SignatureCheck.EXPIRED
        return SignatureCheck.VALID

    def seconds_left(self, expires: int) -> int:
        return max(0, math.floor(expires - self._clock()))

    def _expiry(self, expires_in: timedelta) -> int:
        return math.ceil(self._clock() + check_lifetime(expires_in).total_seconds())

    def _url(self, key: str, query: dict[str, str | int]) -> str:
        return f"{self._base_url}{URL_PATH}{quote(key)}?{urlencode(query)}"


def _without_length_limit(root: Path) -> Path:
    r"""``root`` as an absolute path that file names under it can't make too long.

    Windows refuses paths over 260 characters unless they carry the ``\\?\`` prefix, and
    a photo's key alone is over 150. Elsewhere this is just the absolute path.
    """
    absolute = os.path.abspath(root)  # normalized: the prefix turns off ".." handling
    if os.name != "nt" or absolute.startswith(EXTENDED_PREFIX):
        return Path(absolute)
    if absolute.startswith("\\\\"):  # a network share, \\server\share
        return Path(EXTENDED_PREFIX + "UNC\\" + absolute[2:])
    return Path(EXTENDED_PREFIX + absolute)


async def _in_thread[T](work: Callable[[], T]) -> T:
    """``work`` in a worker thread; disk errors become :class:`StorageUnavailableError`."""
    try:
        return await asyncio.to_thread(work)
    except OSError as error:
        raise StorageUnavailableError(str(error)) from error


def _write_atomically(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # Starts with a dot, so it can never be mistaken for (or clash with) a valid key.
    temporary = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    try:
        temporary.write_bytes(data)
        os.replace(temporary, path)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise


def _read_type(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except (FileNotFoundError, NotADirectoryError):
        return DEFAULT_CONTENT_TYPE


def _prune_empty_parents(path: Path, top: Path) -> None:
    """Remove directories left empty by a delete, up to (not including) ``top``."""
    parent = path.parent
    while parent != top and top in parent.parents:
        try:
            parent.rmdir()
        except OSError:  # not empty, or already gone
            return
        parent = parent.parent
