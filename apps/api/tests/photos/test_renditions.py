"""Renditions of a photo: sizes, orientation, formats, and what they leave out."""

import io
import struct
import zlib

import pillow_heif
import pytest
from PIL import Image

from claimforge_api.photos.renditions import (
    PREVIEW_SIZE,
    THUMBNAIL_SIZE,
    UnreadableImageError,
    render,
)

ORIENTATION = 0x0112
GPS_INFO = 0x8825
ROTATED_90 = 6  # "the camera was turned": stored sideways, shown upright


def image_bytes(
    size: tuple[int, int], *, format: str = "JPEG", mode: str = "RGB", **save: object
) -> bytes:
    out = io.BytesIO()
    Image.new(mode, size, "teal").save(out, format=format, **save)
    return out.getvalue()


def opened(data: bytes) -> Image.Image:
    image = Image.open(io.BytesIO(data))
    image.load()
    return image


def test_sizes_fit_without_distortion() -> None:
    made = render(image_bytes((3000, 2000)))

    assert (made.width, made.height) == (3000, 2000)
    assert opened(made.thumbnail).size == (THUMBNAIL_SIZE, 267)
    assert opened(made.preview).size == (PREVIEW_SIZE, 1067)
    assert opened(made.thumbnail).format == "JPEG"


def test_small_photos_are_not_enlarged() -> None:
    made = render(image_bytes((300, 200)))

    assert opened(made.thumbnail).size == (300, 200)
    assert opened(made.preview).size == (300, 200)


def test_turned_upright() -> None:
    exif = Image.Exif()
    exif[ORIENTATION] = ROTATED_90
    made = render(image_bytes((800, 600), exif=exif.tobytes()))

    # Stored landscape, taken portrait.
    assert (made.width, made.height) == (600, 800)
    assert opened(made.thumbnail).size == (300, 400)


def test_nothing_from_the_original_comes_along() -> None:
    exif = Image.Exif()
    exif[ORIENTATION] = 1
    exif.get_ifd(GPS_INFO)[2] = (30.0, 16.0, 0.0)  # latitude: degrees, minutes, seconds
    original = image_bytes((800, 600), exif=exif.tobytes())
    assert opened(original).getexif().get_ifd(GPS_INFO)  # the original has a location

    made = render(original)

    for data in (made.thumbnail, made.preview):
        rendition = opened(data)
        assert "exif" not in rendition.info
        assert len(rendition.getexif()) == 0
        assert "icc_profile" not in rendition.info


def test_iphone_photos() -> None:
    heic = io.BytesIO()
    pillow_heif.from_pillow(Image.new("RGB", (1200, 900), "teal")).save(heic, quality=80)

    made = render(heic.getvalue())

    assert (made.width, made.height) == (1200, 900)
    assert opened(made.preview).format == "JPEG"


def test_transparency_becomes_white() -> None:
    clear = io.BytesIO()
    Image.new("RGBA", (10, 10), (255, 0, 0, 0)).save(clear, format="PNG")

    made = render(clear.getvalue())

    assert opened(made.thumbnail).convert("RGB").getpixel((5, 5)) == (255, 255, 255)


def png_header(width: int, height: int) -> bytes:
    """A PNG that claims these dimensions and holds no pixels."""
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    chunk = b"IHDR" + ihdr
    return (
        b"\x89PNG\r\n\x1a\n"
        + struct.pack(">I", len(ihdr))
        + chunk
        + struct.pack(">I", zlib.crc32(chunk))
    )


@pytest.mark.parametrize(
    "data",
    [
        b"",
        b"definitely not a photo",
        image_bytes((400, 300))[:200],  # cut off mid-upload
        png_header(20_000, 20_000),  # 400 megapixels from a few bytes
        png_header(100, 100),  # the header, but no pixels
    ],
    ids=["empty", "text", "truncated", "bomb", "no-pixels"],
)
def test_unreadable_files(data: bytes) -> None:
    with pytest.raises(UnreadableImageError):
        render(data)
