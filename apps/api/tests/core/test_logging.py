import json
import logging

import httpx2
import pytest

from claimforge_api.core.logging import JsonFormatter, RequestIdFilter, request_id_var


async def test_generates_a_request_id_and_echoes_it(client: httpx2.AsyncClient) -> None:
    response = await client.get("/healthz")

    request_id = response.headers["x-request-id"]
    assert len(request_id) == 36  # a UUIDv7


async def test_propagates_a_safe_incoming_request_id(client: httpx2.AsyncClient) -> None:
    response = await client.get("/healthz", headers={"X-Request-ID": "lb-7f3a.42_x"})

    assert response.headers["x-request-id"] == "lb-7f3a.42_x"


@pytest.mark.parametrize("unsafe", ["has spaces", "a" * 129, "line\nbreak", "<script>"])
async def test_replaces_unsafe_incoming_request_ids(
    client: httpx2.AsyncClient, unsafe: str
) -> None:
    response = await client.get("/healthz", headers={"X-Request-ID": unsafe})

    assert response.headers["x-request-id"] != unsafe


async def test_writes_an_access_log_line_with_the_request_id(
    client: httpx2.AsyncClient, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.INFO, logger="claimforge.access"):
        response = await client.get("/healthz", headers={"X-Request-ID": "trace-1"})

    record = next(r for r in caplog.records if r.name == "claimforge.access")
    assert response.status_code == 200
    assert record.getMessage() == "GET /healthz 200"
    assert record.__dict__["status"] == 200
    assert record.__dict__["duration_ms"] >= 0
    assert request_id_var.get() is None  # reset after the request


def test_json_formatter_emits_one_object_with_context() -> None:
    record = logging.LogRecord(
        "claimforge.claims", logging.WARNING, "x.py", 1, "Claim %s locked", ("CF-1",), None
    )
    record.claim_id = "CF-1"
    token = request_id_var.set("req-123")
    try:
        RequestIdFilter().filter(record)
    finally:
        request_id_var.reset(token)

    payload = json.loads(JsonFormatter().format(record))

    assert payload["message"] == "Claim CF-1 locked"
    assert payload["level"] == "WARNING"
    assert payload["request_id"] == "req-123"
    assert payload["claim_id"] == "CF-1"
    assert payload["timestamp"].endswith("+00:00")
