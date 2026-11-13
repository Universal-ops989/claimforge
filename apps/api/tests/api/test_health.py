import httpx2
from pydantic import PostgresDsn

from claimforge_api import __version__
from claimforge_api.core.settings import Settings
from claimforge_api.main import create_app


async def test_healthz_reports_ok_and_version(client: httpx2.AsyncClient) -> None:
    response = await client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": __version__}


async def test_healthz_is_documented_in_openapi(client: httpx2.AsyncClient) -> None:
    response = await client.get("/openapi.json")

    assert response.status_code == 200
    assert "/healthz" in response.json()["paths"]


async def test_cors_allows_configured_origins(client: httpx2.AsyncClient) -> None:
    response = await client.options(
        "/healthz",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


async def test_readyz_reports_ready_when_database_answers(client: httpx2.AsyncClient) -> None:
    response = await client.get("/readyz")

    assert response.status_code == 200
    assert response.json() == {"status": "ready", "database": "ok"}


async def test_readyz_returns_503_when_database_is_unreachable(settings: Settings) -> None:
    # Port 1 refuses connections immediately on every platform.
    unreachable = settings.model_copy(
        update={"database_url": PostgresDsn("postgresql+asyncpg://u:p@127.0.0.1:1/none")}
    )
    app = create_app(unreachable)
    transport = httpx2.ASGITransport(app=app)
    async with httpx2.AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/readyz")
    await app.state.engine.dispose()

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable", "database": "unreachable"}
