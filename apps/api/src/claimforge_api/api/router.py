"""Top-level router that mounts every feature router."""

from fastapi import APIRouter

from claimforge_api.api.routes import health

api_router = APIRouter()
api_router.include_router(health.router)
