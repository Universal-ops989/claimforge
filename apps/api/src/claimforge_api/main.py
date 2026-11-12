"""Application entrypoint and factory."""

from fastapi import FastAPI

from claimforge_api import __version__
from claimforge_api.api.router import api_router


def create_app() -> FastAPI:
    """Build a configured FastAPI application.

    A factory (rather than a module-level singleton only) lets tests create
    isolated app instances with overridden dependencies.
    """
    app = FastAPI(
        title="ClaimForge API",
        version=__version__,
        description="Property-damage claims and restoration platform.",
    )
    app.include_router(api_router)
    return app


app = create_app()
