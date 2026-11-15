"""Turning an uploaded photo into the images people look at.

Every photo gets two JPEG renditions: a thumbnail for grids and a preview for viewing. JPEG
because every browser shows it (most can't show HEIC, which iPhones save by default). The
renditions are turned upright from the orientation tag and carry no metadata, so a photo's
GPS location never leaves through them. The original is kept untouched.

Pure functions on bytes: no storage, no database. CPU-bound, so callers run them in a thread.
"""

import io
from dataclasses import dataclass

import pillow_heif
from PIL import Image, ImageOps, UnidentifiedImageError

pillow_heif.register_heif_opener()

#: Longest side of each rendition, in pixels. Never enlarged.
THUMBNAIL_SIZE = 400
PREVIEW_SIZE = 1600
JPEG_QUALITY = 82
#: Refuse images larger than this (a 25 MiB file can claim to be gigapixels: a
#: "decompression bomb"). Phones top out around 50 MP; panoramas a little over 100.
MAX_PIXELS = 200_000_000
# Pillow's own guard, at the same limit. It warns above it (an error when warnings are
# errors) and refuses at twice it; the check in render() refuses first either way.
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


class UnreadableImageError(ValueError):
    """The file isn't an image we can read, or it is unreasonably large."""


@dataclass(frozen=True)
class Renditions:
    #: Of the original, upright (as people see it).
    width: int
    height: int
    thumbnail: bytes
    preview: bytes


def _jpeg(image: Image.Image, longest_side: int) -> bytes:
    copy = image.copy()
    copy.thumbnail((longest_side, longest_side), Image.Resampling.LANCZOS)
    out = io.BytesIO()
    # No exif=, icc_profile= or comment: nothing from the original comes along.
    copy.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    return out.getvalue()


def _flatten(image: Image.Image) -> Image.Image:
    """RGB, with any transparency laid on white (JPEG has no alpha)."""
    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        rgba = image.convert("RGBA")
        background = Image.new("RGB", rgba.size, "white")
        background.paste(rgba, mask=rgba.getchannel("A"))
        return background
    return image.convert("RGB")


def render(data: bytes) -> Renditions:
    """The renditions of the photo in ``data``, or :class:`UnreadableImageError`."""
    try:
        with Image.open(io.BytesIO(data)) as opened:
            width, height = opened.size
            if width * height > MAX_PIXELS:
                raise UnreadableImageError(f"Image is too large: {width} x {height} pixels")
            opened.load()
            upright = ImageOps.exif_transpose(opened)
    except (
        UnidentifiedImageError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
        OSError,
        SyntaxError,
    ) as e:
        # Pillow reports truncated and corrupt files as OSError or SyntaxError.
        raise UnreadableImageError(f"Not a readable image: {e}") from e
    image = _flatten(upright)
    return Renditions(
        width=image.width,
        height=image.height,
        thumbnail=_jpeg(image, THUMBNAIL_SIZE),
        preview=_jpeg(image, PREVIEW_SIZE),
    )
