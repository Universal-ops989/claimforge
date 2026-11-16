"""The drying report: the moisture, air and equipment records that show a job dried right.

It's built from the same services as the API's drying log, drying status and equipment
days, so the PDF and the screen never disagree. Those services check the member's access,
so the report is prepared for (and with the access of) whoever asks for it.
"""

from collections.abc import Sequence
from dataclasses import replace
from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.equipment import placements as equipment
from claimforge_api.equipment.models import EquipmentPlacement
from claimforge_api.moisture import service as moisture
from claimforge_api.moisture.schemas import DryingLog, DryingLogAirValue, DryingStatusRead
from claimforge_api.reports import facts
from claimforge_api.reports.models import ReportKind
from claimforge_api.reports.pdf import Document
from claimforge_api.storage.base import ObjectStorage
from claimforge_api.users.models import User

#: Visit columns per table: wider jobs continue in another table below.
VISITS_PER_TABLE = 7


def chunks[T](items: Sequence[T], size: int) -> list[range]:
    """Index ranges of ``size`` (the last may be shorter); one empty range for no items."""
    if not items:
        return [range(0)]
    return [range(start, min(start + size, len(items))) for start in range(0, len(items), size)]


def visit_label(taken_at: datetime) -> str:
    return taken_at.strftime("%m/%d %H:%M")


def number(value: Decimal | None) -> str:
    return "" if value is None else f"{value:.1f}"


def _label(text: str) -> str:
    return text.replace("_", " ")


def _readings(doc: Document, log: DryingLog) -> None:
    doc.heading("Moisture readings")
    if not log.rooms:
        doc.paragraph("No moisture points have been mapped.")
        return
    visits = [visit_label(v.taken_at) for v in log.visits]
    for room in log.rooms:
        doc.subheading(room.name)
        for columns in chunks(visits, VISITS_PER_TABLE):
            header = ["Point", "Material", "Goal", *(visits[i] for i in columns), "Status"]
            rows = [
                [
                    point.label,
                    f"{point.material} ({_label(point.surface)})",
                    f"{number(point.dry_standard)} {point.dry_standard_basis or ''}".strip() or "-",
                    *(number(point.values[i]) for i in columns),
                    _label(point.status),
                ]
                for point in room.points
            ]
            fixed = [0.08, 0.24, 0.13]
            share = (1 - sum(fixed) - 0.1) / max(len(columns), 1)
            doc.table(header, rows, widths=[*fixed, *([share] * len(columns)), 0.1])


def _air(value: DryingLogAirValue | None) -> str:
    if value is None:
        return ""
    text = (
        f"{value.temperature_f:.1f}°F / {value.relative_humidity:.0f}% / "
        f"{value.grains_per_pound:.1f} gpp"
    )
    if value.grain_depression is not None:
        text += f" (depression {value.grain_depression:.1f})"
    return text


def _atmosphere(doc: Document, log: DryingLog) -> None:
    doc.heading("Atmosphere")
    if not log.atmosphere:
        doc.paragraph("No atmospheric readings were taken.")
        return
    visits = [visit_label(v.taken_at) for v in log.visits]
    doc.paragraph(
        "Temperature / relative humidity / grains of water per pound of dry air. "
        "A dehumidifier's depression is its room's grains less its exhaust's.",
        small=True,
    )
    for columns in chunks(visits, VISITS_PER_TABLE):
        rows = []
        for place in log.atmosphere:
            if place.room is not None:
                name = place.room.name
            elif place.dehumidifier is not None:
                name = f"Dehumidifier {place.dehumidifier.asset_tag}"
            else:
                name = _label(place.location).capitalize()
            rows.append([name, *(_air(place.values[i]) for i in columns)])
        share = 0.82 / max(len(columns), 1)
        doc.table(
            ["Place", *(visits[i] for i in columns)], rows, widths=[0.18, *([share] * len(columns))]
        )


def _equipment(doc: Document, placed: Sequence[EquipmentPlacement], days: Sequence[Any]) -> None:
    doc.heading("Equipment")
    if not placed:
        doc.paragraph("No equipment has been placed.")
        return
    rows = [
        [
            _label(p.kind),
            p.asset_tag,
            p.room.name,
            p.placed_at.strftime("%Y-%m-%d %H:%M"),
            p.removed_at.strftime("%Y-%m-%d %H:%M") if p.removed_at else "running",
            str(p.days),
        ]
        for p in placed
    ]
    doc.table(
        ["Kind", "Unit", "Room", "Placed", "Removed", "Days"],
        rows,
        widths=[0.2, 0.12, 0.18, 0.19, 0.19, 0.12],
    )
    doc.table(
        ["Kind", "Placements", "Running", "Billable days"],
        [[_label(d.kind), str(d.placements), str(d.running), str(d.days)] for d in days],
        widths=[0.4, 0.2, 0.2, 0.2],
    )


def _alerts(doc: Document, status: DryingStatusRead) -> None:
    doc.heading("Alerts")
    if not status.alerts:
        doc.paragraph("Nothing needs attention.")
        return
    doc.table(
        ["Alert", "Since"],
        [[a.message, a.since.strftime("%Y-%m-%d %H:%M") if a.since else ""] for a in status.alerts],
        widths=[0.75, 0.25],
    )


async def render(
    session: AsyncSession,
    storage: ObjectStorage,
    organization_id: UUID,
    claim_id: UUID,
    *,
    user: User,
) -> bytes:
    """The claim's drying report as PDF bytes, prepared for ``user`` with their access."""
    log = await moisture.drying_log(session, organization_id, claim_id, user=user)
    status = await moisture.drying_status(session, organization_id, claim_id, user=user)
    cover = await facts.cover(session, organization_id, claim_id, prepared_by=user)
    branding, options = await facts.branding(session, storage, organization_id, ReportKind.DRYING)

    summary = status.summary
    standing = f"{summary.dry} of {summary.points} points dry" if summary.points else "No points"
    doc = Document(branding)
    doc.cover(replace(cover, extra=[*cover.extra, ("Drying", standing)]))
    _readings(doc, log)
    if options["include_atmosphere"]:
        _atmosphere(doc, log)
    if options["include_equipment"]:
        placed = await equipment.list_placements(session, organization_id, claim_id, user=user)
        days = await equipment.equipment_days_by_kind(session, organization_id, claim_id, user=user)
        _equipment(doc, placed, days)
    if options["include_alerts"]:
        _alerts(doc, status)
    return doc.render()
