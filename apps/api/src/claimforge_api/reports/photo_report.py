"""The photo report: every photo of a claim, labelled, laid out as the template says.

A photo uses its preview (1600 px, upright, no metadata) when processing has made one,
the original otherwise. A file that can't be read becomes a labelled placeholder: one
bad photo never costs the carrier the whole report.
"""

import io
import logging
from collections.abc import Sequence
from dataclasses import dataclass, replace
from datetime import datetime
from typing import Any
from uuid import UUID

import pillow_heif
from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import Flowable, Image, KeepInFrame, Paragraph, Spacer, Table, TableStyle
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from claimforge_api.photos.models import Photo, ProcessingStatus, Rendition, rendition_key
from claimforge_api.reports import facts
from claimforge_api.reports.models import ReportKind
from claimforge_api.reports.pdf import CONTENT_WIDTH, FRAME_HEIGHT, Document, safe
from claimforge_api.storage.base import (
    ObjectNotFoundError,
    ObjectStorage,
    StorageUnavailableError,
)
from claimforge_api.users.models import User

pillow_heif.register_heif_opener()  # HEIC originals, for photos not processed yet
logger = logging.getLogger(__name__)

#: Columns and rows for each "photos per page".
GRIDS = {1: (1, 1), 2: (1, 2), 4: (2, 2), 6: (2, 3)}
#: Height photos share on a page: the frame, less room for a room's heading.
USABLE_HEIGHT = FRAME_HEIGHT - 0.6 * inch
#: Room under each photo for its caption, time and tags.
CAPTION_HEIGHT = 0.7 * inch


@dataclass(frozen=True)
class Shot:
    """One photo, as the report shows it."""

    image: bytes | None  # None: couldn't be read
    filename: str
    caption: str | None
    taken_at: datetime | None
    tags: Sequence[str]
    room: str | None


async def _image(storage: ObjectStorage, photo: Photo) -> bytes | None:
    keys = []
    if photo.processing.status == ProcessingStatus.READY:
        keys.append(rendition_key(photo.storage_key, Rendition.PREVIEW))
    keys.append(photo.storage_key)
    for key in keys:
        try:
            return await storage.get(key)
        except (ObjectNotFoundError, StorageUnavailableError):
            logger.warning("Photo %s: no file at %s", photo.id, key)
    return None


def _fit(data: bytes, width: float, height: float) -> Flowable | None:
    """``data`` as an image no wider or taller than the box, or None if it can't be read."""
    try:
        with PILImage.open(io.BytesIO(data)) as opened:
            opened.load()
            converted = opened.convert("RGB")
    except Exception:  # any unreadable file gets the placeholder
        return None
    out = io.BytesIO()
    converted.save(out, format="JPEG", quality=85)
    scale = min(width / converted.width, height / converted.height)
    return Image(io.BytesIO(out.getvalue()), converted.width * scale, converted.height * scale)


class _Placeholder(Flowable):
    """A grey box saying the photo couldn't be shown."""

    def __init__(self, width: float, height: float) -> None:
        super().__init__()
        self.width, self.height = width, height

    def draw(self) -> None:
        canvas = self.canv
        canvas.setFillColor(colors.HexColor("#E4E7EC"))
        canvas.rect(0, 0, self.width, self.height, stroke=0, fill=1)
        canvas.setFillColor(colors.HexColor("#5B6472"))
        canvas.setFont("Helvetica", 9)
        canvas.drawCentredString(self.width / 2, self.height / 2, "Image unavailable")


def _cell(
    doc: Document, shot: Shot, width: float, height: float, options: dict[str, Any]
) -> Flowable:
    box = height - CAPTION_HEIGHT
    picture = _fit(shot.image, width, box) if shot.image else None
    parts: list[Flowable] = [picture or _Placeholder(width, box), Spacer(1, 3)]
    if options["show_captions"]:
        parts.append(Paragraph(f"<b>{safe(shot.caption or shot.filename)}</b>", doc.styles.cell))
    details = []
    if options["show_taken_at"] and shot.taken_at:
        details.append(shot.taken_at.strftime("Taken %Y-%m-%d %H:%M"))
    if options["show_tags"] and shot.tags:
        details.append(", ".join(shot.tags))
    if details:
        parts.append(Paragraph(safe("  ·  ".join(details)), doc.styles.small))
    return KeepInFrame(width, height, parts, mode="shrink")


def _pages(doc: Document, shots: Sequence[Shot], options: dict[str, Any]) -> None:
    columns, rows = GRIDS[int(options["photos_per_page"])]
    gap = 0.15 * inch
    width = (CONTENT_WIDTH - gap * (columns - 1)) / columns
    # Each row is its photo's height plus a gap; together they must fit USABLE_HEIGHT.
    height = USABLE_HEIGHT / rows - gap
    per_page = columns * rows
    for start in range(0, len(shots), per_page):
        page = [
            _cell(doc, shot, width, height, options) for shot in shots[start : start + per_page]
        ]
        grid = [
            page[r * columns : (r + 1) * columns]
            for r in range((len(page) + columns - 1) // columns)
        ]
        for row in grid:
            row.extend([Spacer(width, 1)] * (columns - len(row)))
        table = Table(
            grid, colWidths=[width + gap] * columns, rowHeights=[height + gap] * len(grid)
        )
        table.setStyle(
            TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0)])
        )
        doc.add(table)
        if start + per_page < len(shots):
            doc.add_page_break()


def _sections(shots: Sequence[Shot], by_room: bool) -> list[tuple[str | None, list[Shot]]]:
    if not by_room:
        return [(None, list(shots))]
    sections: dict[str | None, list[Shot]] = {}
    for shot in shots:
        sections.setdefault(shot.room, []).append(shot)
    named: list[tuple[str | None, list[Shot]]] = [
        (room, group) for room, group in sections.items() if room is not None
    ]
    if None in sections:
        named.append(("Photos without a room", sections[None]))
    return named


def layout(doc: Document, shots: Sequence[Shot], options: dict[str, Any]) -> None:
    """Pour ``shots`` into ``doc``: a page per room (if grouped), then the grid."""
    sections = _sections(shots, bool(options["group_by_room"]))
    for index, (title, group) in enumerate(sections):
        if title:
            doc.heading(title)
        _pages(doc, group, options)
        if index < len(sections) - 1:
            doc.add_page_break()


async def render(
    session: AsyncSession,
    storage: ObjectStorage,
    organization_id: UUID,
    claim_id: UUID,
    *,
    prepared_by: User | None,
) -> bytes:
    """The claim's photo report as PDF bytes. Who may ask for it is checked by the caller."""
    cover = await facts.cover(session, organization_id, claim_id, prepared_by=prepared_by)
    branding, options = await facts.branding(session, storage, organization_id, ReportKind.PHOTO)
    photos = list(
        await session.scalars(
            select(Photo)
            .where(Photo.claim_id == claim_id, Photo.organization_id == organization_id)
            .options(selectinload(Photo.processing), selectinload(Photo.room))
            .order_by(Photo.taken_at.asc().nulls_last(), Photo.id)
        )
    )
    shots = [
        Shot(
            image=await _image(storage, photo),
            filename=photo.original_filename,
            caption=photo.caption,
            taken_at=photo.taken_at,
            tags=photo.tags,
            room=photo.room.name if photo.room else None,
        )
        for photo in photos
    ]
    doc = Document(branding)
    doc.cover(replace(cover, extra=[*cover.extra, ("Photos", str(len(shots)))]))
    if shots:
        layout(doc, shots, options)
    else:
        doc.paragraph("No photos have been added to this claim yet.")
    return doc.render()
