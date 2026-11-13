"""Application entrypoint and factory."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from claimforge_api import __version__
from claimforge_api.api.router import api_router
from claimforge_api.core.settings import Settings, get_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build a configured FastAPI application.

    A factory (rather than a module-level singleton only) lets tests create
    isolated app instances with their own settings and dependency overrides.
    """
    settings = settings or get_settings()

    app = FastAPI(
        title="ClaimForge API",
        version=__version__,
        description="Property-damage claims and restoration platform.",
        debug=settings.debug,
    )
    app.state.settings = settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router)
    return app


app = create_app()
