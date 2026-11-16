"""The drying report: readings with goals, the air, equipment days and alerts, as a PDF."""

import io
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from pypdf import PdfReader
from tests.moisture.conftest import Map
from tests.storage.conftest import local_storage

from claimforge_api.equipment import placements
from claimforge_api.equipment import service as equipment
from claimforge_api.equipment.schemas import EquipmentCreate, PlacementCreate
from claimforge_api.moisture import service as moisture
from claimforge_api.moisture.schemas import MoistureLogCreate
from claimforge_api.reports import drying_report, service
from claimforge_api.reports.schemas import TemplateCreate
from claimforge_api.storage.local import LocalStorage


def test_visits_split_into_tables() -> None:
    assert drying_report.chunks(list(range(9)), 7) == [range(0, 7), range(7, 9)]
    assert drying_report.chunks([], 7) == [range(0)]


@pytest.fixture
def storage(tmp_path: Path) -> LocalStorage:
    return local_storage(tmp_path)


async def render(moisture_map: Map, storage: LocalStorage) -> str:
    pdf = await drying_report.render(
        moisture_map.session,
        storage,
        moisture_map.organization_id,
        moisture_map.claim.id,
        user=moisture_map.user,
    )
    return "\n".join(page.extract_text() for page in PdfReader(io.BytesIO(pdf)).pages)


async def visit(moisture_map: Map, days_ago: float, **body: Any) -> None:
    taken = datetime.now(UTC) - timedelta(days=days_ago)
    await moisture.create_log(
        moisture_map.session,
        moisture_map.organization_id,
        moisture_map.claim.id,
        MoistureLogCreate.model_validate({"taken_at": taken.isoformat()} | body),
        user=moisture_map.user,
    )


async def test_a_drying_job(moisture_map: Map, storage: LocalStorage) -> None:
    kitchen, bath = await moisture_map.room("Kitchen"), await moisture_map.room("Bath")
    dried = await moisture_map.point(kitchen, dry_standard="15", dry_standard_basis="reference")
    unmeasured = await moisture_map.point(bath, material="Subfloor", surface="floor")
    unit = await equipment.create_equipment(
        moisture_map.session,
        moisture_map.organization_id,
        EquipmentCreate.model_validate(
            {"kind": "dehumidifier", "name": "LGR", "asset_tag": "D-12"}
        ),
        user=moisture_map.user,
    )
    dehu = await placements.place(
        moisture_map.session,
        moisture_map.organization_id,
        moisture_map.claim.id,
        PlacementCreate(
            equipment_id=unit.id,
            room_id=kitchen.id,
            placed_at=datetime.now(UTC) - timedelta(days=4),
        ),
        user=moisture_map.user,
    )
    for days_ago, value in ((3, "30"), (2, "20"), (1, "14")):
        await visit(
            moisture_map,
            days_ago,
            readings=[
                {"point_id": str(dried.id), "value": value},
                {"point_id": str(unmeasured.id), "value": "40"},
            ],
            atmosphere=[
                {"location": "outdoors", "temperature_f": 88, "relative_humidity": 70},
                {
                    "location": "room",
                    "room_id": str(kitchen.id),
                    "temperature_f": 78,
                    "relative_humidity": 60,
                },
                {
                    "location": "dehumidifier",
                    "placement_id": str(dehu.id),
                    "temperature_f": 95,
                    "relative_humidity": 22,
                },
            ],
        )

    text = await render(moisture_map, storage)

    assert "1 of 2 points dry" in text
    for expected in (
        "Moisture readings",
        "Kitchen",
        "Drywall (wall)",
        "15.0 reference",
        "30.0",
        "14.0",
        "Subfloor (floor)",
        "no goal",
        "Atmosphere",
        "Outdoors",
        "Dehumidifier D-12",
        "gpp",
        "depression",
        "Equipment",
        "D-12",
        "running",
        "Billable days",
        "Alerts",
        "no dry standard",
        "still running in a room that's dry",
    ):
        assert expected in text, expected


async def test_the_template_chooses_the_sections(moisture_map: Map, storage: LocalStorage) -> None:
    await service.create_template(
        moisture_map.session,
        moisture_map.organization_id,
        TemplateCreate.model_validate(
            {
                "kind": "drying_report",
                "name": "Readings only",
                "title": "Moisture Log",
                "is_default": True,
                "options": {
                    "include_atmosphere": False,
                    "include_equipment": False,
                    "include_alerts": False,
                },
            }
        ),
        user=moisture_map.user,
    )

    text = await render(moisture_map, storage)

    assert "Moisture Log" in text
    assert "Moisture readings" in text
    for absent in ("Atmosphere", "Equipment", "Alerts"):
        assert absent not in text


async def test_long_jobs_split_their_visits(moisture_map: Map, storage: LocalStorage) -> None:
    point = await moisture_map.point(await moisture_map.room("Kitchen"))
    for days_ago in range(9, 0, -1):
        await visit(moisture_map, days_ago, readings=[{"point_id": str(point.id), "value": "20"}])

    text = await render(moisture_map, storage)

    # Two tables (seven visits, then two), each with its own header.
    assert text.count("Material") == 2


async def test_an_empty_job(moisture_map: Map, storage: LocalStorage) -> None:
    text = await render(moisture_map, storage)

    for expected in (
        "No points",
        "No moisture points have been mapped",
        "No atmospheric readings",
        "No equipment has been placed",
        "Nothing needs attention",
    ):
        assert expected in text, expected
