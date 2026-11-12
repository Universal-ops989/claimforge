import httpx2

from claimforge_api import __version__


async def test_healthz_reports_ok_and_version(client: httpx2.AsyncClient) -> None:
    response = await client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": __version__}


async def test_healthz_is_documented_in_openapi(client: httpx2.AsyncClient) -> None:
    response = await client.get("/openapi.json")

    assert response.status_code == 200
    assert "/healthz" in response.json()["paths"]
