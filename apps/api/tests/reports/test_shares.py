"""Shared report links: open without signing in, expire, revoke, and keep no secrets."""

from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlsplit
from uuid import UUID

import httpx2
import pytest
from fastapi import FastAPI
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from tests.conftest import ClientFor

from claimforge_api.audit.models import AuditEvent
from claimforge_api.reports import jobs, shares
from claimforge_api.reports.models import ReportShare
from claimforge_api.users.models import Role

ADDRESS = {"line1": "123 Main St", "city": "Austin", "region": "TX", "postal_code": "78701"}


def path_of(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.path}?{parts.query}" if parts.query else parts.path


class Shared:
    def __init__(self, url: str, report: dict[str, Any]) -> None:
        self.url, self.report = url, report

    @property
    def shares(self) -> str:
        return f"{self.url}/{self.report['id']}/shares"


@pytest.fixture
async def shared(
    auth_client: httpx2.AsyncClient, app: FastAPI, db_session: AsyncSession, organization_id: UUID
) -> Shared:
    base = f"/v1/organizations/{organization_id}"
    claim = (
        await auth_client.post(
            f"{base}/claims", json={"loss_type": "water", "property": {"address": ADDRESS}}
        )
    ).json()
    url = f"{base}/claims/{claim['id']}/reports"
    report = (await auth_client.post(url, json={"kind": "photo_report"})).json()
    while await jobs.process_next(db_session, app.state.storage):
        pass
    return Shared(url, report)


async def make(client: httpx2.AsyncClient, shared: Shared, **body: Any) -> dict[str, Any]:
    response = await client.post(shared.shares, json=body)
    assert response.status_code == 201, response.text
    link: dict[str, Any] = response.json()
    return link


async def test_a_link_opens_without_signing_in(
    auth_client: httpx2.AsyncClient,
    client: httpx2.AsyncClient,
    db_session: AsyncSession,
    shared: Shared,
) -> None:
    link = await make(auth_client, shared, label="Lone Star Mutual", expires_in_days=3)
    assert link["url"].startswith("http://localhost:8000/v1/shared-reports/")
    assert (link["active"], link["open_count"], link["label"]) == (True, 0, "Lone Star Mutual")

    opened = await client.get(path_of(link["url"]))  # no bearer token
    assert opened.status_code == 302
    pdf = await client.get(path_of(opened.headers["location"]))
    assert pdf.content.startswith(b"%PDF")
    assert "Photo Report" in pdf.headers["content-disposition"]

    [listed] = (await auth_client.get(shared.shares)).json()
    assert (listed["open_count"], listed["last_opened_at"] is not None) == (1, True)
    assert "url" not in listed  # shown once only
    token = link["url"].rsplit("/", 1)[1]
    stored = await db_session.scalar(select(ReportShare.token_hash))
    assert stored == shares.hash_token(token)
    assert stored != token


async def test_links_that_dont_work_all_look_alike(
    auth_client: httpx2.AsyncClient,
    client: httpx2.AsyncClient,
    db_session: AsyncSession,
    app: FastAPI,
    shared: Shared,
) -> None:
    revoked = await make(auth_client, shared)
    await auth_client.post(f"{shared.shares}/{revoked['id']}/revoke")
    expiring = await make(auth_client, shared, expires_in_days=1)

    answers = [
        await client.get(path_of(revoked["url"])),
        await client.get("/v1/shared-reports/made-up-token"),
    ]
    for answer in answers:
        assert answer.status_code == 404
        assert answer.json()["code"] == "share_not_found"
    later = datetime.now(UTC) + timedelta(days=2)
    with pytest.raises(shares.ShareNotFoundError):
        await shares.open_link(
            db_session, app.state.storage, expiring["url"].rsplit("/", 1)[1], now=later
        )

    listed = {s["id"]: s for s in (await auth_client.get(shared.shares)).json()}
    assert listed[revoked["id"]]["active"] is False
    assert listed[revoked["id"]]["revoked_at"] is not None


async def test_only_ready_reports_are_shared(
    auth_client: httpx2.AsyncClient, shared: Shared
) -> None:
    queued = (await auth_client.post(shared.url, json={"kind": "drying_report"})).json()

    response = await auth_client.post(f"{shared.url}/{queued['id']}/shares", json={})

    assert (response.status_code, response.json()["code"]) == (409, "report_not_ready")
    too_long = await auth_client.post(shared.shares, json={"expires_in_days": 31})
    assert too_long.status_code == 422


async def test_opens_stay_out_of_the_audit_log(
    auth_client: httpx2.AsyncClient,
    client: httpx2.AsyncClient,
    db_session: AsyncSession,
    shared: Shared,
) -> None:
    link = await make(auth_client, shared, label="Homeowner")
    for _ in range(3):
        await client.get(path_of(link["url"]))
    await auth_client.post(f"{shared.shares}/{link['id']}/revoke")

    events = await db_session.scalar(
        select(func.count()).where(AuditEvent.entity_type == "report_share")
    )
    assert events == 2  # created, revoked: not three opens
    claim_url = shared.url.removesuffix("/reports")
    timeline = (await auth_client.get(f"{claim_url}/timeline", params={"kind": "reports"})).json()
    assert [e["summary"] for e in timeline["items"]][:2] == [
        "Revoked a report link for Homeowner",
        "Shared a report by link for Homeowner",
    ]


async def test_deleting_the_report_ends_its_links(
    auth_client: httpx2.AsyncClient,
    client: httpx2.AsyncClient,
    client_for: ClientFor,
    db_session: AsyncSession,
    shared: Shared,
) -> None:
    link = await make(auth_client, shared)
    technician = await client_for(Role.TECHNICIAN)
    viewer = await client_for(Role.VIEWER)
    assert (await technician.post(shared.shares, json={})).status_code == 403
    assert (await viewer.get(shared.shares)).status_code == 200

    await auth_client.delete(f"{shared.url}/{shared.report['id']}")

    assert (await client.get(path_of(link["url"]))).status_code == 404
    assert await db_session.scalar(select(func.count()).select_from(ReportShare)) == 0
