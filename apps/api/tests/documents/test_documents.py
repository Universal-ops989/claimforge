"""Attaching documents to claims: upload, links, editing, filters, deletes and cleanup."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlsplit
from uuid import UUID

import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tests.photos.conftest import Site, member, open_claim
from tests.storage.conftest import local_storage

from claimforge_api.audit.models import AuditEvent
from claimforge_api.claims import service as claims
from claimforge_api.claims.models import Claim
from claimforge_api.claims.schemas import ClaimStatusChangeCreate
from claimforge_api.core.errors import PermissionDeniedError
from claimforge_api.documents import service
from claimforge_api.documents.models import Document, DocumentUpload
from claimforge_api.documents.schemas import (
    DocumentListQuery,
    DocumentUpdate,
    DocumentUploadCreate,
)
from claimforge_api.storage.local import LocalStorage
from claimforge_api.uploads import service as uploads
from claimforge_api.users.models import Role, User
from claimforge_api.worker.runner import Worker

PDF = b"%PDF-1.7 a signed work authorization"
MAX_BYTES = 1024


def describe(data: bytes = PDF, **fields: Any) -> DocumentUploadCreate:
    body = {
        "filename": "WA-1042 signed.pdf",
        "content_type": "application/pdf",
        "size_bytes": len(data),
    }
    return DocumentUploadCreate.model_validate(body | fields)


class Desk:
    """One claim, its storage, and someone filing its paperwork."""

    def __init__(
        self,
        session: AsyncSession,
        storage: LocalStorage,
        organization_id: UUID,
        claim: Claim,
        user: User,
    ) -> None:
        self.session, self.storage = session, storage
        self.organization_id, self.claim, self.user = organization_id, claim, user

    def by(self, user: User) -> "Desk":
        return Desk(self.session, self.storage, self.organization_id, self.claim, user)

    async def start(self, data: bytes = PDF, **fields: Any) -> DocumentUpload:
        upload, _ = await service.start_upload(
            self.session,
            self.storage,
            self.organization_id,
            self.claim.id,
            describe(data, **fields),
            user=self.user,
            max_bytes=MAX_BYTES,
        )
        return upload

    async def complete(self, upload_id: UUID) -> tuple[Document, bool]:
        return await service.complete_upload(
            self.session,
            self.storage,
            self.organization_id,
            self.claim.id,
            upload_id,
            user=self.user,
        )

    async def attach(self, data: bytes = PDF, **fields: Any) -> Document:
        upload = await self.start(data, **fields)
        await self.storage.put(upload.storage_key, data, content_type=upload.content_type)
        document, created = await self.complete(upload.id)
        assert created
        return document

    async def edit(self, document: Document, **fields: Any) -> Document:
        return await service.update_document(
            self.session,
            self.organization_id,
            self.claim.id,
            document.id,
            DocumentUpdate.model_validate(fields),
            user=self.user,
        )

    async def documents(self, **filters: Any) -> list[UUID]:
        page = await service.list_documents(
            self.session,
            self.organization_id,
            self.claim.id,
            DocumentListQuery.model_validate(filters),
            user=self.user,
            limit=50,
            cursor=None,
        )
        return [d.id for d in page.items]


@pytest.fixture
async def desk(db_session: AsyncSession, organization_id: UUID, user: User, tmp_path: Path) -> Desk:
    claim = await open_claim(db_session, organization_id, user)
    return Desk(db_session, local_storage(tmp_path), organization_id, claim, user)


def query_of(url: str) -> dict[str, list[str]]:
    return parse_qs(urlsplit(url).query)


async def test_attach_a_document(desk: Desk) -> None:
    upload = await desk.start(category="authorization")
    assert upload.storage_key.endswith(f"/documents/{upload.id}/file")
    assert await desk.documents() == []  # nothing until it's complete

    await desk.storage.put(upload.storage_key, PDF, content_type="application/pdf")
    document, created = await desk.complete(upload.id)
    again, created_again = await desk.complete(upload.id)

    assert (created, created_again, again.id) == (True, False, document.id)
    assert (document.title, document.category) == ("WA-1042 signed", "authorization")
    shown = await service.present(desk.storage, document)
    assert query_of(shown.download_url)["filename"] == ["WA-1042 signed.pdf"]
    assert shown.view_url is not None
    assert "filename" not in query_of(shown.view_url)
    assert shown.uploaded_by is not None
    assert shown.uploaded_by.full_name == "Morgan Member"
    assert await desk.documents() == [document.id]


@pytest.mark.parametrize(
    ("filename", "title"),
    [
        ("WA-1042 signed.pdf", "WA-1042 signed"),
        ("report.final.v2.pdf", "report.final.v2"),
        ("C:\\Scans\\letter.pdf", "letter"),
        ("no extension", "no extension"),
        (".eml", ".eml"),
    ],
)
def test_default_titles(filename: str, title: str) -> None:
    assert service.default_title(filename) == title


async def test_only_some_types_open_in_the_browser(desk: Desk) -> None:
    docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    word = await desk.attach(b"PK word", filename="Scope.docx", content_type=docx)
    scan = await desk.attach(b"\xff\xd8 scan", filename="scan.jpg", content_type="image/jpeg")

    assert (await service.present(desk.storage, word)).view_url is None
    assert (await service.present(desk.storage, scan)).view_url is not None


def test_what_can_be_attached() -> None:
    assert describe(title="  Carrier letter ").title == "Carrier letter"
    invalid: list[dict[str, Any]] = [
        {"content_type": "text/html"},  # would run as a page
        {"content_type": "image/svg+xml"},  # so would this
        {"content_type": "application/zip"},
        {"title": "   "},
        {"category": "receipt"},
        {"size_bytes": 0},
    ]
    for fields in invalid:
        with pytest.raises(ValidationError):
            describe(**fields)


async def test_the_file_is_checked(desk: Desk) -> None:
    upload = await desk.start()

    with pytest.raises(uploads.UploadNotReceivedError):
        await service.complete_upload(
            desk.session,
            desk.storage,
            desk.organization_id,
            desk.claim.id,
            upload.id,
            user=desk.user,
        )
    await desk.storage.put(upload.storage_key, PDF + b"!", content_type="application/pdf")
    with pytest.raises(uploads.UploadMismatchError):
        await service.complete_upload(
            desk.session,
            desk.storage,
            desk.organization_id,
            desk.claim.id,
            upload.id,
            user=desk.user,
        )
    assert await desk.storage.stat(upload.storage_key) is None
    with pytest.raises(service.DocumentTooLargeError):
        await desk.start(b"x" * (MAX_BYTES + 1))


async def test_editing(desk: Desk) -> None:
    document = await desk.attach()

    edited = await desk.edit(document, title="Signed authorization", category="authorization")
    assert (edited.title, edited.category) == ("Signed authorization", "authorization")
    await desk.edit(document, title="Signed authorization")  # no change: no history
    with pytest.raises(ValidationError, match="cannot be null"):
        DocumentUpdate.model_validate({"category": None})

    changes = list(
        await desk.session.scalars(
            select(AuditEvent.changes).where(
                AuditEvent.entity_id == document.id, AuditEvent.action == "document.updated"
            )
        )
    )
    assert changes == [
        {
            "title": ["WA-1042 signed", "Signed authorization"],
            "category": ["other", "authorization"],
        }
    ]


async def test_filter_by_category(desk: Desk) -> None:
    estimate = await desk.attach(category="estimate")
    invoice = await desk.attach(category="invoice")
    await desk.attach(category="report")

    assert await desk.documents(category=["estimate"]) == [estimate.id]
    assert await desk.documents(category=["estimate", "invoice"]) == [invoice.id, estimate.id]
    assert len(await desk.documents()) == 3


async def test_deleting_removes_the_file(desk: Desk) -> None:
    document = await desk.attach()

    await service.delete_document(
        desk.session, desk.storage, desk.organization_id, desk.claim.id, document.id, user=desk.user
    )

    assert await desk.documents() == []
    assert await desk.storage.stat(document.storage_key) is None
    actions = list(
        await desk.session.scalars(
            select(AuditEvent.action).where(AuditEvent.entity_id == document.id)
        )
    )
    assert sorted(actions) == ["document.created", "document.deleted"]


async def test_access(desk: Desk) -> None:
    document = await desk.attach()
    site = Site(desk.session, desk.storage, desk.organization_id, desk.claim, desk.user)
    viewer = await member(site, Role.VIEWER)

    assert await desk.by(viewer).documents() == [document.id]
    with pytest.raises(PermissionDeniedError):
        await desk.by(viewer).start()
    with pytest.raises(PermissionDeniedError):
        await desk.by(viewer).edit(document, title="Mine")
    await claims.change_status(
        desk.session,
        desk.organization_id,
        desk.claim.id,
        ClaimStatusChangeCreate.model_validate({"status": "cancelled", "reason": "Duplicate"}),
        user=desk.user,
    )
    with pytest.raises(claims.ClaimLockedError):
        await desk.attach()


async def test_the_worker_discards_abandoned_document_uploads(desk: Desk) -> None:
    sent = await desk.start()
    await desk.storage.put(sent.storage_key, PDF, content_type="application/pdf")
    sent.expires_at = datetime.now(UTC) - timedelta(days=1)
    await desk.session.commit()

    @asynccontextmanager
    async def sessions() -> AsyncIterator[AsyncSession]:
        yield desk.session

    worker = Worker(sessions=sessions, storage=desk.storage)

    assert await worker.clean_up() == 1
    assert await desk.storage.stat(sent.storage_key) is None
    assert list(await desk.session.scalars(select(DocumentUpload.id))) == []
