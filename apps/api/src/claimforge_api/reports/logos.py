"""Company logos for report templates: checked, shrunk and stored as PNG.

Re-encoding instead of storing the upload as it came proves the file is an image, drops
its metadata, and leaves the PDF engine one format to place.
"""

import io
from uuid import UUID

from PIL import Image, UnidentifiedImageError

from claimforge_api.core.errors import BusinessRuleError

MAX_BYTES = 2 * 1024 * 1024
#: Logos are shrunk (never enlarged) to fit this box: a page header doesn't need more.
MAX_SIZE = (1200, 600)
ACCEPTED = frozenset({"PNG", "JPEG", "WEBP"})
CONTENT_TYPE = "image/png"


class LogoInvalidError(BusinessRuleError):
    code = "logo_invalid"
    title = "The logo can't be used"


def logo_key(organization_id: UUID, template_id: UUID) -> str:
    return f"organizations/{organization_id}/report-templates/{template_id}/logo.png"


def normalize(data: bytes) -> bytes:
    """``data`` as a PNG that fits :data:`MAX_SIZE`, or :class:`LogoInvalidError`."""
    if len(data) > MAX_BYTES:
        raise LogoInvalidError("Logos can be at most 2 MB", limit=MAX_BYTES)
    try:
        with Image.open(io.BytesIO(data)) as opened:
            if opened.format not in ACCEPTED:
                raise LogoInvalidError(
                    f"Send a PNG, JPEG or WebP, not {opened.format}", image_format=opened.format
                )
            opened.load()
            image = opened.convert("RGBA")
    except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError):
        raise LogoInvalidError("The file isn't a readable image") from None
    image.thumbnail(MAX_SIZE, Image.Resampling.LANCZOS)
    out = io.BytesIO()
    image.save(out, format="PNG", optimize=True)
    return out.getvalue()
