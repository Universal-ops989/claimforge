"""Reports over HTTP: request, poll until ready, download, list, delete; and the timeline."""

from typing import Any
from urllib.parse import urlsplit
from uuid import UUID

import httpx2
import pytest
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncSession
from tests.conftest import ClientFor

from claimforge_api.reports import jobs
from claimforge_api.users.models import Role

ADDRESS = {"line1": "123 Main St", "city": "Austin", "region": "TX", "postal_code": "78701"}


def path_of(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.path}?{parts.query}"


@pytest.fixture
async def claim(auth_client: httpx2.AsyncClient, organization_id: UUID) -> dict[str, Any]:
    response = await auth_client.post(
        f"/v1/organizations/{organization_id}/claims",
        json={"loss_type": "water", "property": {"address": ADDRESS}},
    )
    created: dict[str, Any] = response.json()
    return created


def reports_url(organization_id: UUID, claim: dict[str, Any]) -> str:
    return f"/v1/organizations/{organization_id}/claims/{claim['id']}/reports"


async def run_worker(app: FastAPI, session: AsyncSession) -> None:
    while await jobs.process_next(session, app.state.storage):
        pass


async def test_request_poll_download(
    auth_client: httpx2.AsyncClient,
    client: httpx2.AsyncClient,
    app: FastAPI,
    db_session: AsyncSession,
    organization_id: UUID,
    claim: dict[str, Any],
) -> None:
    url = reports_url(organization_id, claim)

    requested = await auth_client.post(url, json={"kind": "photo_report"})
    assert requested.status_code == 202, requested.text
    job = requested.json()
    assert (job["status"], job["download_url"], job["requested_by"]["full_name"]) == (
        "queued",
        None,
        "Morgan Member",
    )
    assert requested.headers["location"] == f"{url}/{job['id']}"
    assert requested.headers["retry-after"] == "2"
    polled = await auth_client.get(requested.headers["location"])
    assert (polled.json()["status"], polled.headers["retry-after"]) == ("queued", "2")

    await run_worker(app, db_session)

    ready = await auth_client.get(f"{url}/{job['id']}")
    assert "retry-after" not in ready.headers
    body = ready.json()
    assert body["status"] == "ready"
    assert body["size_bytes"] > 0
    pdf = await client.get(path_of(body["download_url"]))
    assert pdf.content.startswith(b"%PDF")
    assert pdf.headers["content-type"] == "application/pdf"
    assert f'filename="Photo Report {claim["number"]}.pdf"' in pdf.headers["content-disposition"]

    timeline = (
        await auth_client.get(
            f"{url.removesuffix('/reports')}/timeline", params={"kind": "reports"}
        )
    ).json()
    assert [e["summary"] for e in timeline["items"]] == [
        "Generated the photo report",
        "Requested a photo report",
    ]


async def test_list_delete_and_access(
    auth_client: httpx2.AsyncClient,
    client: httpx2.AsyncClient,
    client_for: ClientFor,
    app: FastAPI,
    db_session: AsyncSession,
    organization_id: UUID,
    claim: dict[str, Any],
) -> None:
    url = reports_url(organization_id, claim)
    first = (await auth_client.post(url, json={"kind": "photo_report"})).json()
    second = (await auth_client.post(url, json={"kind": "drying_report"})).json()
    await run_worker(app, db_session)

    listed = (await auth_client.get(url)).json()
    assert [r["id"] for r in listed] == [second["id"], first["id"]]
    link = listed[1]["download_url"]

    viewer = await client_for(Role.VIEWER)
    technician = await client_for(Role.TECHNICIAN)
    assert (await viewer.get(f"{url}/{first['id']}")).status_code == 200
    assert (await technician.post(url, json={"kind": "photo_report"})).status_code == 403
    assert (await viewer.delete(f"{url}/{first['id']}")).status_code == 403
    assert (await auth_client.post(url, json={"kind": "invoice"})).status_code == 422

    assert (await auth_client.delete(f"{url}/{first['id']}")).status_code == 204
    assert (await auth_client.get(f"{url}/{first['id']}")).status_code == 404
    assert (await client.get(path_of(link))).status_code == 404  # the file went too
