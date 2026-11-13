"""Top-level router that mounts every feature router."""

from fastapi import APIRouter

from claimforge_api.api.routes import health
from claimforge_api.organizations.router import router as organizations_router

# Business endpoints are versioned so breaking changes can ship as /v2 side by side.
v1_router = APIRouter(prefix="/v1")
v1_router.include_router(organizations_router)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(v1_router)
