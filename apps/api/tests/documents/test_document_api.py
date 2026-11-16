"""Claim documents over HTTP: attach through the signed link, then list, edit and delete."""

from typing import Any
from urllib.parse import urlsplit
from uuid import UUID, uuid4

import httpx2
import pytest
from tests.conftest import ClientFor

from claimforge_api.users.models import Role

ADDRESS = {"line1": "123 Main St", "city": "Austin", "region": "TX", "postal_code": "78701"}
PDF = b"%PDF-1.7 a signed work authorization"
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def path_of(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.path}?{parts.query}"


async def send(client: httpx2.AsyncClient, method: str, url: str, **body: Any) -> dict[str, Any]:
    response = await client.request(method, url, json=body or None)
    assert response.status_code < 300, response.text
    payload: dict[str, Any] = response.json() if response.content else {}
    return payload


@pytest.fixture
async def url(auth_client: httpx2.AsyncClient, organization_id: UUID) -> str:
    base = f"/v1/organizations/{organization_id}"
    claim = await send(
        auth_client, "POST", f"{base}/claims", loss_type="water", property={"address": ADDRESS}
    )
    return f"{base}/claims/{claim['id']}"


def described(data: bytes = PDF, **fields: Any) -> dict[str, Any]:
    return {
        "filename": "WA-1042 signed.pdf",
        "content_type": "application/pdf",
        "size_bytes": len(data),
    } | fields


async def attach(
    auth_client: httpx2.AsyncClient,
    anonymous: httpx2.AsyncClient,
    url: str,
    data: bytes = PDF,
    **fields: Any,
) -> dict[str, Any]:
    started = await send(
        auth_client, "POST", f"{url}/document-uploads", **described(data, **fields)
    )
    link = started["upload"]
    sent = await anonymous.request(
        link["method"], path_of(link["url"]), content=data, headers=link["headers"]
    )
    assert sent.status_code == 204, sent.text
    completed = await auth_client.post(f"{url}/document-uploads/{started['id']}/complete")
    assert completed.status_code == 201, completed.text
    document: dict[str, Any] = completed.json()
    return document


async def test_attach_view_edit_and_delete(
    auth_client: httpx2.AsyncClient, client: httpx2.AsyncClient, url: str
) -> None:
    document = await attach(auth_client, client, url, category="authorization")
    assert (document["title"], document["category"]) == ("WA-1042 signed", "authorization")
    assert document["uploaded_by"]["full_name"] == "Morgan Member"

    again = await auth_client.post(f"{url}/document-uploads/{document['id']}/complete")
    assert again.status_code == 200

    viewed = await client.get(path_of(document["view_url"]))
    assert (viewed.content, viewed.headers["content-disposition"]) == (PDF, "inline")
    saved = await client.get(path_of(document["download_url"]))
    assert saved.headers["content-disposition"].startswith(
        'attachment; filename="WA-1042 signed.pdf"'
    )

    edited = await send(
        auth_client, "PATCH", f"{url}/documents/{document['id']}", title="Signed WA"
    )
    assert edited["title"] == "Signed WA"
    await send(auth_client, "PATCH", f"{url}/documents/{document['id']}", category="report")
    fetched = await send(auth_client, "GET", f"{url}/documents/{document['id']}")
    assert (fetched["title"], fetched["category"]) == ("Signed WA", "report")

    assert (await auth_client.delete(f"{url}/documents/{document['id']}")).status_code == 204
    assert (await auth_client.get(f"{url}/documents/{document['id']}")).status_code == 404
    assert (await client.get(path_of(document["download_url"]))).status_code == 404

    timeline = (await auth_client.get(f"{url}/timeline", params={"kind": "documents"})).json()
    assert [entry["summary"] for entry in timeline["items"]] == [
        "Deleted document “Signed WA”",
        "Recategorized document “Signed WA” as report",
        "Renamed document “WA-1042 signed” to “Signed WA”",
        "Attached authorization “WA-1042 signed”",
    ]


async def test_listing(
    auth_client: httpx2.AsyncClient, client: httpx2.AsyncClient, url: str
) -> None:
    estimate = await attach(auth_client, client, url, category="estimate", title="Estimate")
    sheet = await attach(
        auth_client,
        client,
        url,
        b"PK sheet",
        filename="Moisture log.xlsx",
        content_type=XLSX,
        category="report",
    )
    invoice = await attach(auth_client, client, url, category="invoice", title="Invoice")

    everything = (await auth_client.get(f"{url}/documents")).json()["items"]
    assert [d["id"] for d in everything] == [invoice["id"], sheet["id"], estimate["id"]]
    assert sheet["view_url"] is None  # browsers can't show a spreadsheet
    picked = await auth_client.get(f"{url}/documents", params={"category": ["estimate", "invoice"]})
    assert [d["id"] for d in picked.json()["items"]] == [invoice["id"], estimate["id"]]
    first = (await auth_client.get(f"{url}/documents", params={"limit": 2})).json()
    assert (len(first["items"]), first["has_more"]) == (2, True)


async def test_problems(auth_client: httpx2.AsyncClient, client_for: ClientFor, url: str) -> None:
    too_large = await auth_client.post(
        f"{url}/document-uploads", json=described(size_bytes=50 * 1024 * 1024 + 1)
    )
    assert too_large.status_code == 422
    assert too_large.json()["code"] == "document_too_large"

    invalid: list[dict[str, Any]] = [
        {"content_type": "text/html"},
        {"category": "receipt"},
        {"title": " "},
    ]
    for fields in invalid:
        response = await auth_client.post(f"{url}/document-uploads", json=described(**fields))
        assert response.status_code == 422, fields

    started = await send(auth_client, "POST", f"{url}/document-uploads", **described())
    early = await auth_client.post(f"{url}/document-uploads/{started['id']}/complete")
    assert (early.status_code, early.json()["code"]) == (409, "upload_not_received")
    unknown = await auth_client.post(f"{url}/document-uploads/{uuid4()}/complete")
    assert unknown.status_code == 404

    viewer = await client_for(Role.VIEWER)
    assert (await viewer.post(f"{url}/document-uploads", json=described())).status_code == 403
    assert (await viewer.get(f"{url}/documents")).status_code == 200
