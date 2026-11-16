"""The PDF engine every report shares: branded pages, a cover, and building blocks.

Built on ReportLab's platypus: a report is a list of flowables poured into letter-size
pages that carry the template's logo and header on top and its footer with "Page X of Y"
at the bottom. Renderers (photo report, drying report) only decide what goes in.

Text goes into ReportLab's mini-markup, so it's escaped; and the built-in PDF fonts only
draw Windows-1252, so anything else becomes "?" instead of breaking the render.
"""

import io
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

PAGE_WIDTH, PAGE_HEIGHT = letter
MARGIN = 0.6 * inch
HEADER_HEIGHT = 0.75 * inch
FOOTER_HEIGHT = 0.45 * inch
#: Width available to the content.
CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN
LIGHT = colors.HexColor("#F2F4F7")
MUTED = colors.HexColor("#5B6472")


def safe(text: object) -> str:
    """``text`` ready for a Paragraph: markup escaped, unprintable characters replaced."""
    plain = str(text).encode("cp1252", "replace").decode("cp1252")
    return escape(plain).replace("\n", "<br/>")


@dataclass(frozen=True)
class Branding:
    """What a template puts on every page."""

    title: str
    accent: str = "#1F4E79"
    header_text: str | None = None
    footer_text: str | None = None
    logo: bytes | None = None  # a PNG (reports/logos.py)


@dataclass(frozen=True)
class Cover:
    """The facts a report's first page states."""

    claim_number: str
    loss_type: str
    loss_date: date | None
    address: str
    policyholder: str | None
    prepared_at: datetime
    prepared_by: str | None = None
    extra: Sequence[tuple[str, str]] = field(default_factory=tuple)


class _Styles:
    def __init__(self, accent: colors.Color) -> None:
        base = getSampleStyleSheet()
        self.body = ParagraphStyle("body", parent=base["BodyText"], fontSize=9.5, leading=12.5)
        self.small = ParagraphStyle(
            "small", parent=self.body, fontSize=8, leading=10, textColor=MUTED
        )
        self.heading = ParagraphStyle(
            "heading",
            parent=base["Heading2"],
            fontSize=13,
            leading=16,
            textColor=accent,
            spaceBefore=10,
            spaceAfter=6,
        )
        self.cover_title = ParagraphStyle(
            "cover_title",
            parent=base["Title"],
            fontSize=26,
            leading=31,
            textColor=accent,
            alignment=TA_CENTER,
            spaceAfter=18,
        )
        self.cell = ParagraphStyle("cell", parent=self.body, fontSize=8.5, leading=10.5)
        self.cell_head = ParagraphStyle(
            "cell_head", parent=self.cell, textColor=colors.white, fontName="Helvetica-Bold"
        )


class Document:
    """A report being written: add flowables, then :meth:`render`."""

    def __init__(self, branding: Branding) -> None:
        self.branding = branding
        self.accent = colors.HexColor(branding.accent)
        self.styles = _Styles(self.accent)
        self.story: list[Flowable] = []

    # Building blocks

    def cover(self, facts: Cover) -> None:
        rows: list[tuple[str, str]] = [
            ("Claim", facts.claim_number),
            ("Loss", facts.loss_type.replace("_", " ").capitalize()),
            ("Date of loss", long_date(facts.loss_date) if facts.loss_date else "-"),
            ("Property", facts.address),
            ("Policyholder", facts.policyholder or "-"),
            *facts.extra,
            ("Prepared", facts.prepared_at.strftime("%Y-%m-%d %H:%M UTC")),
        ]
        if facts.prepared_by:
            rows.append(("Prepared by", facts.prepared_by))
        self.story += [
            Spacer(1, 1.2 * inch),
            Paragraph(safe(self.branding.title), self.styles.cover_title),
            self.key_values(rows),
            PageBreak(),
        ]

    def heading(self, text: str) -> None:
        self.story.append(Paragraph(safe(text), self.styles.heading))

    def paragraph(self, text: str, *, small: bool = False) -> None:
        self.story.append(Paragraph(safe(text), self.styles.small if small else self.styles.body))

    def key_values(self, rows: Sequence[tuple[str, str]]) -> Table:
        data = [
            [Paragraph(f"<b>{safe(k)}</b>", self.styles.cell), Paragraph(safe(v), self.styles.cell)]
            for k, v in rows
        ]
        table = Table(data, colWidths=[1.7 * inch, CONTENT_WIDTH - 1.7 * inch])
        table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LINEBELOW", (0, 0), (-1, -1), 0.25, LIGHT),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        return table

    def table(
        self,
        header: Sequence[str],
        rows: Sequence[Sequence[object]],
        widths: Sequence[float] | None = None,
    ) -> None:
        """A data table that repeats its header on every page, rows striped."""
        body = [[Paragraph(safe(h), self.styles.cell_head) for h in header]]
        body += [[Paragraph(safe(c), self.styles.cell) for c in row] for row in rows]
        column_widths: Any = (
            [w * CONTENT_WIDTH for w in widths]
            if widths
            else [CONTENT_WIDTH / len(header)] * len(header)
        )
        table = Table(body, colWidths=column_widths, repeatRows=1)
        style: list[tuple[Any, ...]] = [
            ("BACKGROUND", (0, 0), (-1, 0), self.accent),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]
        style += [("BACKGROUND", (0, r), (-1, r), LIGHT) for r in range(2, len(body), 2)]
        table.setStyle(TableStyle(style))
        self.story.append(table)

    def add(self, *flowables: Flowable) -> None:
        self.story.extend(flowables)

    def add_page_break(self) -> None:
        self.story.append(PageBreak())

    # Rendering

    def _decorate(self, canvas: Canvas, _: BaseDocTemplate) -> None:
        canvas.saveState()
        top = PAGE_HEIGHT - MARGIN
        x = MARGIN
        if self.branding.logo:
            logo = ImageReader(io.BytesIO(self.branding.logo))
            width, height = logo.getSize()
            scale = min((HEADER_HEIGHT - 8) / height, 2.2 * inch / width)
            canvas.drawImage(
                logo, x, top - height * scale, width * scale, height * scale, mask="auto"
            )
            x += width * scale + 10
        canvas.setFillColor(MUTED)
        canvas.setFont("Helvetica", 8)
        for n, line in enumerate((self.branding.header_text or "").splitlines()[:4]):
            canvas.drawString(x, top - 9 - n * 10, _plain(line))
        canvas.setStrokeColor(self.accent)
        canvas.setLineWidth(1.5)
        canvas.line(MARGIN, top - HEADER_HEIGHT, PAGE_WIDTH - MARGIN, top - HEADER_HEIGHT)
        canvas.restoreState()

    def render(self) -> bytes:
        out = io.BytesIO()
        doc = BaseDocTemplate(
            out,
            pagesize=letter,
            leftMargin=MARGIN,
            rightMargin=MARGIN,
            topMargin=MARGIN + HEADER_HEIGHT + 6,
            bottomMargin=MARGIN + FOOTER_HEIGHT,
            title=_plain(self.branding.title),
        )
        frame = Frame(
            doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="content", showBoundary=0
        )
        doc.addPageTemplates([PageTemplate(id="page", frames=[frame], onPage=self._decorate)])
        footer = _plain(self.branding.footer_text or "")
        accent = self.accent

        class Numbered(Canvas):
            """Holds each page until the count is known, then writes "Page X of Y"."""

            def __init__(self, *args: Any, **kwargs: Any) -> None:
                super().__init__(*args, **kwargs)
                self._pages: list[dict[str, Any]] = []

            def showPage(self) -> None:  # noqa: N802 (ReportLab's name)
                self._pages.append(dict(self.__dict__))
                # ReportLab's own page-count recipe; the stubs leave _startPage out.
                self._startPage()  # type: ignore[attr-defined]

            def save(self) -> None:
                total = len(self._pages)
                for number, state in enumerate(self._pages, start=1):
                    self.__dict__.update(state)
                    self.setFont("Helvetica", 7.5)
                    self.setFillColor(MUTED)
                    self.drawString(MARGIN, MARGIN, footer[:160])
                    self.setFillColor(accent)
                    self.drawRightString(PAGE_WIDTH - MARGIN, MARGIN, f"Page {number} of {total}")
                    super().showPage()
                super().save()

        doc.build(list(self.story), canvasmaker=Numbered)
        return out.getvalue()


def _plain(text: str) -> str:
    """For drawString: no markup, only what the built-in fonts can draw."""
    return text.encode("cp1252", "replace").decode("cp1252")


def long_date(day: date) -> str:
    """ "November 14, 2026" (strftime's unpadded day differs between platforms)."""
    return f"{day:%B} {day.day}, {day.year}"
