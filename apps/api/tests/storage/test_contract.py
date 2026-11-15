"""What every storage backend promises, whichever one is configured."""

from datetime import UTC, datetime, timedelta

import pytest

from claimforge_api.storage.base import (
    InvalidKeyError,
    ObjectInfo,
    ObjectNotFoundError,
    ObjectStorage,
)

KEY = "organizations/0192/claims/0193/photos/0194/original.jpg"
HOUR = timedelta(hours=1)


async def test_round_trip(storage: ObjectStorage) -> None:
    info = await storage.put(KEY, b"\xff\xd8 jpeg bytes", content_type="image/jpeg")

    assert info == ObjectInfo(key=KEY, size=13, content_type="image/jpeg")
    assert await storage.get(KEY) == b"\xff\xd8 jpeg bytes"
    assert await storage.stat(KEY) == info


async def test_put_replaces(storage: ObjectStorage) -> None:
    await storage.put(KEY, b"first", content_type="image/jpeg")
    await storage.put(KEY, b"second!", content_type="IMAGE/PNG")

    assert await storage.get(KEY) == b"second!"
    assert await storage.stat(KEY) == ObjectInfo(key=KEY, size=7, content_type="image/png")


async def test_empty_objects_are_objects(storage: ObjectStorage) -> None:
    await storage.put("empty.txt", b"", content_type="text/plain; charset=UTF-8")

    assert await storage.get("empty.txt") == b""
    assert await storage.stat("empty.txt") == ObjectInfo(
        key="empty.txt", size=0, content_type="text/plain; charset=UTF-8"
    )


async def test_missing_objects(storage: ObjectStorage) -> None:
    await storage.put(f"{KEY}.thumb", b"x", content_type="image/jpeg")

    with pytest.raises(ObjectNotFoundError):
        await storage.get(KEY)
    assert await storage.stat(KEY) is None
    # A prefix of other keys is not an object.
    assert await storage.stat("organizations/0192") is None
    with pytest.raises(ObjectNotFoundError):
        await storage.get("organizations/0192")


async def test_delete(storage: ObjectStorage) -> None:
    await storage.put(KEY, b"x", content_type="image/jpeg")
    await storage.put("organizations/0192/kept.jpg", b"y", content_type="image/jpeg")

    await storage.delete(KEY)
    await storage.delete(KEY)  # already gone: fine

    assert await storage.stat(KEY) is None
    assert await storage.get("organizations/0192/kept.jpg") == b"y"
    # The key can be used again.
    await storage.put(KEY, b"z", content_type="image/jpeg")
    assert await storage.get(KEY) == b"z"


@pytest.mark.parametrize(
    "key",
    [
        "",
        "/absolute.jpg",
        "../escape.jpg",
        "a/../../escape.jpg",
        "a/./b.jpg",
        "a//b.jpg",
        "trailing/",
        ".hidden",
        "back\\slash.jpg",
        "space here.jpg",
        "x" * 513,
    ],
)
async def test_unsafe_keys_never_reach_the_backend(storage: ObjectStorage, key: str) -> None:
    with pytest.raises(InvalidKeyError):
        await storage.put(key, b"x", content_type="image/jpeg")
    with pytest.raises(InvalidKeyError):
        await storage.get(key)
    with pytest.raises(InvalidKeyError):
        await storage.stat(key)
    with pytest.raises(InvalidKeyError):
        await storage.delete(key)
    with pytest.raises(InvalidKeyError):
        await storage.upload_url(key, content_type="image/jpeg", expires_in=HOUR)
    with pytest.raises(InvalidKeyError):
        await storage.download_url(key, expires_in=HOUR)


@pytest.mark.parametrize("content_type", ["", "jpeg", "image/", "image/jpeg\r\nX-Evil: 1"])
async def test_content_types_are_checked(storage: ObjectStorage, content_type: str) -> None:
    with pytest.raises(ValueError, match="content type"):
        await storage.put(KEY, b"x", content_type=content_type)
    with pytest.raises(ValueError, match="content type"):
        await storage.upload_url(KEY, content_type=content_type, expires_in=HOUR)


async def test_signed_upload_describes_the_request(storage: ObjectStorage) -> None:
    before = datetime.now(UTC)
    upload = await storage.upload_url(KEY, content_type="Image/JPEG", expires_in=HOUR)

    assert upload.method == "PUT"
    assert upload.headers == {"Content-Type": "image/jpeg"}
    assert before + HOUR - timedelta(seconds=2) <= upload.expires_at
    assert upload.expires_at <= datetime.now(UTC) + HOUR + timedelta(seconds=2)


@pytest.mark.parametrize("expires_in", [timedelta(0), timedelta(seconds=-5), timedelta(days=8)])
async def test_url_lifetimes_are_bounded(storage: ObjectStorage, expires_in: timedelta) -> None:
    with pytest.raises(ValueError, match="expire"):
        await storage.upload_url(KEY, content_type="image/jpeg", expires_in=expires_in)
    with pytest.raises(ValueError, match="expire"):
        await storage.download_url(KEY, expires_in=expires_in)
