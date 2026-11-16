"""CSV price imports: parsing spreadsheets' habits, all-or-nothing, merge, replace, dry run."""

from decimal import Decimal
from typing import Any
from uuid import UUID

import httpx2
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tests.conftest import ClientFor

from claimforge_api.audit.models import AuditEvent
from claimforge_api.pricing import imports
from claimforge_api.users.models import Role

HEADER = "code,description,unit,unit_price,category\n"


def parse(text: str, encoding: str = "utf-8") -> imports.Parsed:
    return imports.parse(text.encode(encoding))


def test_columns_in_any_order_and_case() -> None:
    parsed = parse(
        # Spreadsheets quote a price with a thousands separator.
        'Unit, Price ,CODE,Description,Notes\nda,"$1,234.50 ",wtr dhm,Dehu,ignore me\n'
    )

    [row] = parsed.rows
    assert (row.code, row.unit, row.unit_price, row.category) == (
        "wtr dhm",
        "DA",
        Decimal("1234.50"),
        None,
    )
    assert parsed.ignored_columns == ["notes"]


@pytest.mark.parametrize(
    "text",
    [
        "﻿" + HEADER + "A,Thing,EA,1.00,X\n",  # Excel's byte-order mark
        "code;description;unit;unit_price;category\nA;Thing;EA;1.00;X\n",  # European Excel
        "code\tdescription\tunit\tunit_price\tcategory\nA\tThing\tEA\t1.00\tX\n",
        HEADER + "A,Thing,EA,1.00,X\n\n,,,,\n",  # blank lines at the end
    ],
    ids=["bom", "semicolons", "tabs", "trailing-blanks"],
)
def test_spreadsheet_habits(text: str) -> None:
    parsed = parse(text)
    assert [(r.code, r.unit_price) for r in parsed.rows] == [("A", Decimal("1.00"))]
    assert parsed.errors == []


def test_every_problem_by_line() -> None:
    parsed = parse(
        HEADER
        + "A,Thing,EA,1.00,X\n"
        + "B,,EA,1.00,X\n"  # no description
        + "C,Thing,E A,abc,X\n"  # bad unit and price
        + "a,Again,EA,2.00,X\n"  # repeats line 2's code
    )

    assert [(e.line, e.column) for e in parsed.errors] == [
        (3, "description"),
        (4, "unit"),
        (4, "unit_price"),
        (5, "code"),
    ]
    assert "already on line 2" in parsed.errors[-1].message


@pytest.mark.parametrize(
    ("data", "message"),
    [
        (b"", "empty"),
        (b"code,description\nA,Thing\n", "Missing columns: unit, unit_price"),
        ("code,description,unit,unit_price\nA,Café,EA,1\n".encode("cp1252"), "UTF-8"),
    ],
)
def test_files_that_cant_be_read(data: bytes, message: str) -> None:
    with pytest.raises(imports.ImportInvalidError, match=message):
        imports.parse(data)


# ─── Over HTTP ────────────────────────────────────────────────────────────────


@pytest.fixture
async def list_url(auth_client: httpx2.AsyncClient, organization_id: UUID) -> str:
    url = f"/v1/organizations/{organization_id}/price-lists"
    created = (await auth_client.post(url, json={"name": "TX Austin Nov 2026"})).json()
    return f"{url}/{created['id']}"


async def upload(
    client: httpx2.AsyncClient, list_url: str, text: str, expect: int = 200, **params: Any
) -> dict[str, Any]:
    response = await client.post(
        f"{list_url}/import",
        content=text.encode("utf-8"),
        params=params,
        headers={"Content-Type": "text/csv"},
    )
    assert response.status_code == expect, response.text
    result: dict[str, Any] = response.json()
    return result


async def prices(client: httpx2.AsyncClient, list_url: str) -> dict[str, str]:
    items = (await client.get(f"{list_url}/items", params={"limit": 100})).json()["items"]
    return {item["code"]: item["unit_price"] for item in items}


FIRST = HEADER + "WTR DHM,Dehumidifier,DA,123.40,WTR\nWTR DRYAM,Air mover,DA,33.50,WTR\n"


async def test_merge_then_replace(auth_client: httpx2.AsyncClient, list_url: str) -> None:
    first = await upload(auth_client, list_url, FIRST)
    assert (first["rows"], first["added"], first["mode"]) == (2, 2, "merge")

    second = HEADER + "WTR DHM,Dehumidifier,DA,125.00,WTR\nDRY 1/2,Drywall,SF,2.15,DRY\n"
    merged = await upload(auth_client, list_url, second)
    assert (merged["added"], merged["updated"], merged["unchanged"], merged["removed"]) == (
        1,
        1,
        0,
        0,
    )
    assert await prices(auth_client, list_url) == {
        "DRY 1/2": "2.15",
        "WTR DHM": "125.00",
        "WTR DRYAM": "33.50",
    }

    replaced = await upload(auth_client, list_url, second, mode="replace")
    assert (replaced["unchanged"], replaced["removed"]) == (2, 1)
    assert set(await prices(auth_client, list_url)) == {"DRY 1/2", "WTR DHM"}


async def test_dry_run_changes_nothing(
    auth_client: httpx2.AsyncClient, list_url: str, db_session: AsyncSession
) -> None:
    preview = await upload(auth_client, list_url, FIRST, dry_run="true", mode="replace")

    assert (preview["dry_run"], preview["added"]) == (True, 2)
    assert await prices(auth_client, list_url) == {}
    assert (await auth_client.get(list_url)).json()["imported_at"] is None

    await upload(auth_client, list_url, FIRST)
    price_list = (await auth_client.get(list_url)).json()
    assert price_list["imported_at"] is not None
    stamped = await db_session.scalar(
        select(AuditEvent).where(AuditEvent.action == "price_list.updated")
    )
    assert stamped is not None
    assert "imported_at" in stamped.changes


async def test_one_bad_row_imports_nothing(auth_client: httpx2.AsyncClient, list_url: str) -> None:
    problem = await upload(auth_client, list_url, FIRST + "BAD,Broken,EA,-5,X\n", expect=422)

    assert problem["code"] == "import_invalid"
    assert problem["error_count"] == 1
    assert problem["row_errors"][0]["line"] == 4
    assert problem["row_errors"][0]["column"] == "unit_price"
    assert await prices(auth_client, list_url) == {}


async def test_size_and_access(
    auth_client: httpx2.AsyncClient,
    client_for: ClientFor,
    list_url: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(imports, "MAX_BYTES", 50)
    too_big = await upload(auth_client, list_url, FIRST, expect=422)
    assert too_big["limit"] == 50
    monkeypatch.undo()

    technician = await client_for(Role.TECHNICIAN)
    refused = await technician.post(
        f"{list_url}/import", content=FIRST.encode(), headers={"Content-Type": "text/csv"}
    )
    assert refused.status_code == 403
