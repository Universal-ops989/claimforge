"""The storage interface every backend implements, and the rules for keys and URLs."""

import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Literal, Protocol
from urllib.parse import quote

#: Longest key accepted. S3 allows 1024 bytes; staying well under leaves room for prefixes.
MAX_KEY_LENGTH = 512
#: S3 refuses signatures valid for longer than a week; local URLs follow the same rule.
MAX_URL_LIFETIME = timedelta(days=7)

# Segments start with a letter or digit, so "." and ".." (and hidden files) are impossible.
_SEGMENT = r"[A-Za-z0-9][A-Za-z0-9._-]*"
_KEY = re.compile(rf"{_SEGMENT}(?:/{_SEGMENT})*")
# type/subtype with optional parameters, nothing that could end a header line.
_CONTENT_TYPE = re.compile(r"[a-z0-9][a-z0-9!#$&^_.+-]*/[a-z0-9][a-z0-9!#$&^_.+-]*(?:;[ -~]*)?")
_UNSAFE_FILENAME_CHARS = re.compile(r'[\x00-\x1f\x7f"\\/]')


class InvalidKeyError(ValueError):
    """A key that is not a relative path of safe segments."""


class ObjectNotFoundError(LookupError):
    """No object is stored under the key."""


def check_key(key: str) -> str:
    """``key`` unchanged if every backend can store it safely, else :class:`InvalidKeyError`."""
    if len(key) > MAX_KEY_LENGTH or not _KEY.fullmatch(key):
        raise InvalidKeyError(f"Invalid storage key: {key[:80]!r}")
    return key


def check_content_type(content_type: str) -> str:
    """``content_type`` with its ``type/subtype`` lowercased, if it is a valid media type.

    Parameters (``; charset=utf-8``) are kept as given: some of them are case-sensitive.
    """
    media_type, separator, parameters = content_type.strip().partition(";")
    normalized = media_type.strip().lower() + separator + parameters
    if len(normalized) > 255 or not _CONTENT_TYPE.fullmatch(normalized):
        raise ValueError(f"Invalid content type: {content_type[:80]!r}")
    return normalized


def check_lifetime(expires_in: timedelta) -> timedelta:
    if not timedelta(0) < expires_in <= MAX_URL_LIFETIME:
        raise ValueError("Signed URLs must expire within a week")
    return expires_in


def content_disposition(filename: str | None) -> str:
    """``attachment`` with ``filename`` (RFC 6266), or ``inline`` when there is none.

    The quoted ``filename`` is an ASCII fallback; ``filename*`` carries the real name.
    """
    if not filename:
        return "inline"
    cleaned = _UNSAFE_FILENAME_CHARS.sub("_", filename).strip() or "download"
    fallback = cleaned.encode("ascii", "replace").decode("ascii").replace("?", "_")
    return f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{quote(cleaned, safe='')}"


@dataclass(frozen=True)
class ObjectInfo:
    key: str
    size: int
    content_type: str


@dataclass(frozen=True)
class SignedUpload:
    """Where and how a client uploads one object: send ``headers`` with the body."""

    url: str
    method: Literal["PUT"]
    headers: dict[str, str]
    expires_at: datetime


class ObjectStorage(Protocol):
    """Bytes under keys. Keys are checked with :func:`check_key` by every method."""

    async def put(self, key: str, data: bytes, *, content_type: str) -> ObjectInfo:
        """Store ``data`` under ``key``, replacing any object already there."""
        ...

    async def get(self, key: str) -> bytes:
        """The object's bytes, or :class:`ObjectNotFoundError`."""
        ...

    async def stat(self, key: str) -> ObjectInfo | None:
        """Size and content type, or ``None`` when nothing is stored under ``key``."""
        ...

    async def delete(self, key: str) -> None:
        """Remove the object. Deleting a missing object is not an error."""
        ...

    async def upload_url(
        self, key: str, *, content_type: str, expires_in: timedelta
    ) -> SignedUpload:
        """A URL that accepts one upload of ``content_type`` to ``key`` until it expires.

        Size is not limited by the URL: check :meth:`stat` once the client reports back.
        """
        ...

    async def download_url(
        self, key: str, *, expires_in: timedelta, filename: str | None = None
    ) -> str:
        """A URL that serves the object until it expires.

        With ``filename`` browsers save it under that name; without, they show it inline.
        """
        ...
