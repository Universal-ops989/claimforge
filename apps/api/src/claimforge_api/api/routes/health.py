"""Liveness endpoint used by load balancers and orchestrators."""

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from claimforge_api import __version__

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok"]
    version: str


@router.get("/healthz", response_model=HealthResponse, summary="Liveness probe")
async def healthz() -> HealthResponse:
    return HealthResponse(status="ok", version=__version__)
