from collections.abc import AsyncIterator

import httpx2
import pytest
from fastapi import APIRouter, FastAPI
from pydantic import BaseModel

from claimforge_api.api.problems import PROBLEM_MEDIA_TYPE
from claimforge_api.core.errors import (
    BusinessRuleError,
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
)


class NewRoom(BaseModel):
    name: str
    area_sq_ft: float


router = APIRouter()


@router.get("/boom/not-found")
async def not_found() -> None:
    raise NotFoundError("Claim CF-1042 does not exist", claim_id="CF-1042")


@router.get("/boom/conflict")
async def conflict() -> None:
    raise ConflictError("Claim number already in use")


@router.get("/boom/forbidden")
async def forbidden() -> None:
    raise PermissionDeniedError()


@router.get("/boom/rule")
async def rule() -> None:
    raise BusinessRuleError("Close all tasks before closing the claim")


@router.post("/boom/rooms")
async def create_room(room: NewRoom) -> NewRoom:
    return room


@router.get("/boom/crash")
async def crash() -> None:
    raise RuntimeError("database password is hunter2")  # must never reach the client


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[httpx2.AsyncClient]:
    app.include_router(router)
    # Starlette re-raises unhandled errors after responding; keep the response instead.
    transport = httpx2.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx2.AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c


@pytest.mark.parametrize(
    ("path", "status", "code"),
    [
        ("/boom/not-found", 404, "not_found"),
        ("/boom/conflict", 409, "conflict"),
        ("/boom/forbidden", 403, "permission_denied"),
        ("/boom/rule", 422, "business_rule_violation"),
    ],
)
async def test_domain_errors_become_problems(
    client: httpx2.AsyncClient, path: str, status: int, code: str
) -> None:
    response = await client.get(path)
    body = response.json()

    assert response.status_code == status
    assert response.headers["content-type"] == PROBLEM_MEDIA_TYPE
    assert body["status"] == status
    assert body["code"] == code
    assert body["type"] == f"https://claimforge.dev/problems/{code.replace('_', '-')}"
    assert body["instance"] == path
    assert body["request_id"] == response.headers["x-request-id"]


async def test_domain_error_extras_are_included(client: httpx2.AsyncClient) -> None:
    body = (await client.get("/boom/not-found")).json()

    assert body["detail"] == "Claim CF-1042 does not exist"
    assert body["claim_id"] == "CF-1042"


async def test_validation_errors_list_each_field(client: httpx2.AsyncClient) -> None:
    response = await client.post("/boom/rooms", json={"area_sq_ft": "big"})
    body = response.json()

    assert response.status_code == 422
    assert body["code"] == "validation_failed"
    assert {tuple(e["loc"]) for e in body["errors"]} == {
        ("body", "name"),
        ("body", "area_sq_ft"),
    }


async def test_unknown_routes_and_methods_are_problems(client: httpx2.AsyncClient) -> None:
    missing = await client.get("/nope")
    wrong_method = await client.delete("/healthz")

    assert (missing.status_code, missing.json()["code"]) == (404, "not_found")
    assert (wrong_method.status_code, wrong_method.json()["code"]) == (405, "method_not_allowed")
    assert "allow" in wrong_method.headers


async def test_crashes_hide_internals_but_keep_the_request_id(
    client: httpx2.AsyncClient, caplog: pytest.LogCaptureFixture
) -> None:
    response = await client.get("/boom/crash", headers={"X-Request-ID": "crash-1"})
    body = response.json()

    assert response.status_code == 500
    assert body["code"] == "internal_error"
    assert "hunter2" not in response.text
    assert body["request_id"] == "crash-1"
    assert response.headers["x-request-id"] == "crash-1"
    assert any("Unhandled error" in r.getMessage() and r.exc_info for r in caplog.records)
