"""Application entrypoint and factory."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute

from claimforge_api import __version__
from claimforge_api.api.middleware import REQUEST_ID_HEADER, RequestContextMiddleware
from claimforge_api.api.problems import register_problem_handlers
from claimforge_api.api.router import api_router
from claimforge_api.audit import recorder as audit_recorder
from claimforge_api.core.database import create_engine, create_session_factory
from claimforge_api.core.logging import configure_logging
from claimforge_api.core.rate_limit import InMemoryRateLimiter
from claimforge_api.core.settings import Settings, get_settings
from claimforge_api.invitations.delivery import LoggingInvitationSender


def _operation_id(route: APIRoute) -> str:
    """Handler names as operation ids: generated clients get ``listOrganizations()``."""
    return route.name


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield
    # Close pooled connections cleanly on shutdown.
    await app.state.engine.dispose()


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build a configured FastAPI application.

    A factory (rather than a module-level singleton only) lets tests create
    isolated app instances with their own settings and dependency overrides.
    """
    settings = settings or get_settings()
    audit_recorder.install()

    app = FastAPI(
        title="ClaimForge API",
        version=__version__,
        description="Property-damage claims and restoration platform.",
        debug=settings.debug,
        lifespan=lifespan,
        generate_unique_id_function=_operation_id,
    )
    app.state.settings = settings
    # Creating the engine does no I/O; connections open lazily on first use.
    app.state.engine = create_engine(settings)
    app.state.session_factory = create_session_factory(app.state.engine)
    # Replaced by the email sender when notifications land.
    app.state.invitation_sender = LoggingInvitationSender()
    # Per-instance buckets; replace with a shared store when running several instances.
    app.state.rate_limiter = InMemoryRateLimiter()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        # Let the web app show the request id in error messages for support.
        expose_headers=[REQUEST_ID_HEADER],
    )
    # Added last so it is the outermost middleware: every response gets a request id.
    app.add_middleware(RequestContextMiddleware)
    register_problem_handlers(app)
    app.include_router(api_router)
    return app


def create_production_app() -> FastAPI:
    """Server entry point: configures process-wide logging, then builds the app.

    Run with ``uvicorn claimforge_api.main:create_production_app --factory`` so nothing
    happens at import time (tests import this module without side effects).
    """
    settings = get_settings()
    configure_logging(settings)
    return create_app(settings)
