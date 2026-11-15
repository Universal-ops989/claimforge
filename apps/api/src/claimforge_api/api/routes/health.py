"""Liveness and readiness endpoints for load balancers and orchestrators."""

import logging
from typing import Literal

from fastapi import APIRouter, Response, status
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError

from claimforge_api import __version__
from claimforge_api.api.deps import EngineDep, StorageDep
from claimforge_api.core.database import ping
from claimforge_api.storage.base import StorageUnavailableError

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok"]
    version: str


class ReadinessResponse(BaseModel):
    status: Literal["ready", "unavailable"]
    database: Literal["ok", "unreachable"]
    storage: Literal["ok", "unreachable"]


@router.get("/healthz", response_model=HealthResponse, summary="Liveness probe")
async def healthz() -> HealthResponse:
    """The process is up. Never touches dependencies, so it can't cascade failures."""
    return HealthResponse(status="ok", version=__version__)


@router.get(
    "/readyz",
    response_model=ReadinessResponse,
    summary="Readiness probe",
    responses={503: {"model": ReadinessResponse, "description": "A dependency is unavailable"}},
)
async def readyz(engine: EngineDep, storage: StorageDep, response: Response) -> ReadinessResponse:
    """Ready to serve traffic: the database answers a trivial query and storage is usable."""
    database: Literal["ok", "unreachable"] = "ok"
    try:
        await ping(engine)
    except (SQLAlchemyError, OSError):
        logger.warning("Readiness check failed: database unreachable", exc_info=True)
        database = "unreachable"
    storage_state: Literal["ok", "unreachable"] = "ok"
    try:
        await storage.ping()
    except StorageUnavailableError:
        logger.warning("Readiness check failed: storage unavailable", exc_info=True)
        storage_state = "unreachable"
    if database == storage_state == "ok":
        return ReadinessResponse(status="ready", database=database, storage=storage_state)
    response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return ReadinessResponse(status="unavailable", database=database, storage=storage_state)
