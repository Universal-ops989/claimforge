"""The local-disk backend's own guarantees: layout, atomic writes, tidy deletes, signing."""

from datetime import timedelta
from pathlib import Path

import pytest
from tests.storage.conftest import SECRET, local_storage

from claimforge_api.storage.base import StorageUnavailableError, content_disposition
from claimforge_api.storage.signing import UrlSigner

HOUR = timedelta(hours=1)


async def test_objects_and_types_on_disk(tmp_path: Path) -> None:
    storage = local_storage(tmp_path)

    await storage.put("a/b/photo.jpg", b"jpeg", content_type="image/jpeg")

    assert (tmp_path / "objects" / "a" / "b" / "photo.jpg").read_bytes() == b"jpeg"
    assert (tmp_path / "types" / "a" / "b" / "photo.jpg").read_text() == "image/jpeg"
    # Nothing but the object itself is left behind.
    assert [p.name for p in (tmp_path / "objects" / "a" / "b").iterdir()] == ["photo.jpg"]


async def test_a_failed_write_leaves_no_trace(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    storage = local_storage(tmp_path)
    await storage.put("photo.jpg", b"original", content_type="image/jpeg")

    def broken_replace(*_: object) -> None:
        raise OSError("disk full")

    monkeypatch.setattr("claimforge_api.storage.local.os.replace", broken_replace)
    with pytest.raises(StorageUnavailableError, match="disk full"):
        await storage.put("photo.jpg", b"half", content_type="image/jpeg")
    monkeypatch.undo()

    assert await storage.get("photo.jpg") == b"original"
    assert sorted(p.name for p in (tmp_path / "objects").iterdir()) == ["photo.jpg"]


async def test_deletes_remove_emptied_directories(tmp_path: Path) -> None:
    storage = local_storage(tmp_path)
    await storage.put("org/claim/one.jpg", b"1", content_type="image/jpeg")
    await storage.put("org/other.jpg", b"2", content_type="image/jpeg")

    await storage.delete("org/claim/one.jpg")

    assert not (tmp_path / "objects" / "org" / "claim").exists()
    assert not (tmp_path / "types" / "org" / "claim").exists()
    assert (tmp_path / "objects" / "org" / "other.jpg").exists()
    await storage.delete("org/other.jpg")
    assert list((tmp_path / "objects").iterdir()) == []


async def test_objects_without_a_type_file(tmp_path: Path) -> None:
    storage = local_storage(tmp_path)
    (tmp_path / "objects").mkdir()
    (tmp_path / "objects" / "copied-in.bin").write_bytes(b"\x00")

    info = await storage.stat("copied-in.bin")

    assert info is not None
    assert info.content_type == "application/octet-stream"


async def test_signed_urls_point_at_the_api(tmp_path: Path) -> None:
    storage = local_storage(tmp_path)

    upload = await storage.upload_url("org/photo-1.jpg", content_type="image/jpeg", expires_in=HOUR)
    download = await storage.download_url("org/photo-1.jpg", expires_in=HOUR, filename="a b")

    assert upload.url.startswith("http://testserver/v1/storage/org/photo-1.jpg?expires=")
    assert download.startswith("http://testserver/v1/storage/org/photo-1.jpg?expires=")
    assert download.endswith("&filename=a+b")


def test_signatures_cover_every_part() -> None:
    signer = UrlSigner(SECRET)
    signature = signer.sign("PUT", "a/b", "100", "image/jpeg")

    assert signer.verify(signature, "PUT", "a/b", "100", "image/jpeg")
    for parts in [
        ("GET", "a/b", "100", "image/jpeg"),
        ("PUT", "a/c", "100", "image/jpeg"),
        ("PUT", "a/b", "101", "image/jpeg"),
        ("PUT", "a/b", "100", "image/png"),
        ("PUT", "a", "b", "100", "image/jpeg"),
    ]:
        assert not signer.verify(signature, *parts)
    assert not UrlSigner(b"another secret").verify(signature, "PUT", "a/b", "100", "image/jpeg")


@pytest.mark.parametrize(
    ("filename", "header"),
    [
        (None, "inline"),
        ("", "inline"),
        ("report.pdf", "attachment; filename=\"report.pdf\"; filename*=UTF-8''report.pdf"),
        (
            "Café plan.pdf",
            "attachment; filename=\"Caf_ plan.pdf\"; filename*=UTF-8''Caf%C3%A9%20plan.pdf",
        ),
        (
            'a"b\\c/d\r\n.txt',
            "attachment; filename=\"a_b_c_d__.txt\"; filename*=UTF-8''a_b_c_d__.txt",
        ),
    ],
)
def test_content_disposition(filename: str | None, header: str) -> None:
    assert content_disposition(filename) == header


async def test_long_keys_fit_on_every_platform(tmp_path: Path) -> None:
    # Over 300 characters under the root: beyond Windows' classic 260-character limit.
    key = "/".join(letter * 100 for letter in "abc") + "/photo.jpg"
    storage = local_storage(tmp_path)

    await storage.put(key, b"jpeg", content_type="image/jpeg")

    assert await storage.get(key) == b"jpeg"
    await storage.delete(key)
    assert await storage.stat(key) is None
