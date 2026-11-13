"""The OpenAPI document is a product: generated clients depend on its shape."""

from collections import Counter
from pathlib import Path
from typing import Any

import pytest

from claimforge_api import openapi

SCHEMA = openapi.build_schema()
OPERATIONS: list[tuple[str, str, dict[str, Any]]] = [
    (method, path, operation)
    for path, item in SCHEMA["paths"].items()
    for method, operation in item.items()
]


def test_operation_ids_are_unique_and_readable() -> None:
    ids = Counter(op["operationId"] for _, _, op in OPERATIONS)

    assert [name for name, count in ids.items() if count > 1] == []
    assert all(name.isidentifier() and "_v1_" not in name for name in ids)


@pytest.mark.parametrize(("method", "path", "operation"), OPERATIONS, ids=lambda v: str(v)[:40])
def test_every_operation_is_summarised(method: str, path: str, operation: dict[str, Any]) -> None:
    assert operation.get("summary"), f"{method.upper()} {path} needs a summary"


@pytest.mark.parametrize(
    ("method", "path", "operation"),
    [o for o in OPERATIONS if o[1].startswith("/v1/")],
    ids=lambda v: str(v)[:40],
)
def test_versioned_operations_document_problem_responses(
    method: str, path: str, operation: dict[str, Any]
) -> None:
    for status in ("401", "404", "422"):
        assert status in operation["responses"], f"{method.upper()} {path} lacks {status}"


def test_committed_schema_is_current() -> None:
    assert openapi.main(["--check"]) == 0, "Run `just api-openapi` and commit openapi.json"


def test_check_detects_stale_files(tmp_path: Path) -> None:
    stale = tmp_path / "openapi.json"
    stale.write_text("{}\n", encoding="utf-8")

    assert openapi.main(["--check", "--output", str(stale)]) == 1
    assert openapi.main(["--output", str(stale)]) == 0
    assert openapi.main(["--check", "--output", str(stale)]) == 0
