"""Report jobs: queued on request, rendered by the worker, and failing with a reason."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession
from tests.photos.conftest import Site, member

from claimforge_api.claims import service as claims
from claimforge_api.claims.schemas import ClaimStatusChangeCreate
from claimforge_api.core.errors import PermissionDeniedError
from claimforge_api.photos.processing import MAX_ATTEMPTS
from claimforge_api.reports import jobs
from claimforge_api.reports.models import JobStatus, ReportJob, ReportKind
from claimforge_api.storage.base import ObjectInfo, StorageUnavailableError
from claimforge_api.storage.local import LocalStorage
from claimforge_api.users.models import Membership, Role
from claimforge_api.worker.runner import Worker


async def ask(site: Site, kind: ReportKind = ReportKind.PHOTO) -> ReportJob:
    return await jobs.request(
        site.session, site.organization_id, site.claim.id, kind, user=site.user
    )


async def refreshed(session: AsyncSession, job: ReportJob) -> ReportJob:
    await session.refresh(job)
    return job


async def test_requesting_and_rendering(site: Site) -> None:
    photo = await ask(site, ReportKind.PHOTO)
    drying = await ask(site, ReportKind.DRYING)
    assert (photo.status, photo.requested_by_id) == ("queued", site.user.id)

    done = [await jobs.process_next(site.session, site.storage) for _ in range(3)]

    assert done == [photo.id, drying.id, None]  # oldest first, then nothing waiting
    for job in (photo, drying):
        ready = await refreshed(site.session, job)
        assert (ready.status, ready.attempts, ready.error) == ("ready", 1, None)
        assert ready.storage_key is not None
        assert ready.storage_key.endswith(f"/reports/{job.id}.pdf")
        stored = await site.storage.get(ready.storage_key)
        assert stored.startswith(b"%PDF")
        assert ready.size_bytes == len(stored)
        assert ready.finished_at is not None


async def test_who_may_ask(site: Site) -> None:
    technician = await member(site, Role.TECHNICIAN)
    with pytest.raises(PermissionDeniedError):
        await jobs.request(
            site.session, site.organization_id, site.claim.id, ReportKind.PHOTO, user=technician
        )
    # Closed claims can have reports: that's often when carriers want them.
    await claims.change_status(
        site.session,
        site.organization_id,
        site.claim.id,
        ClaimStatusChangeCreate.model_validate({"status": "cancelled", "reason": "Duplicate"}),
        user=site.user,
    )
    assert (await ask(site)).status == "queued"


async def test_a_report_needs_its_member(site: Site) -> None:
    gone = await ask(site)
    gone.requested_by_id = None
    lost = await jobs.request(
        site.session,
        site.organization_id,
        site.claim.id,
        ReportKind.DRYING,
        user=await member(site, Role.ADJUSTER),
    )
    await site.session.execute(delete(Membership).where(Membership.user_id == lost.requested_by_id))
    await site.session.commit()

    await jobs.process_next(site.session, site.storage)
    await jobs.process_next(site.session, site.storage)

    gone = await refreshed(site.session, gone)
    assert (gone.status, gone.error) == ("failed", "The member who asked for this report is gone")
    lost = await refreshed(site.session, lost)
    assert lost.status == "failed"
    assert lost.storage_key is None


class StorageDown:
    """Reads work; writes fail, as when the bucket is unreachable."""

    def __init__(self, storage: LocalStorage) -> None:
        self.storage = storage

    def __getattr__(self, name: str) -> Any:
        return getattr(self.storage, name)

    async def put(self, key: str, data: bytes, *, content_type: str) -> ObjectInfo:
        raise StorageUnavailableError("bucket unreachable")


async def test_storage_outages_back_off_then_give_up(site: Site) -> None:
    job = await ask(site)
    down = StorageDown(site.storage)
    now = datetime.now(UTC)

    await jobs.process_next(site.session, down, now=now)
    waiting = await refreshed(site.session, job)
    assert (waiting.status, waiting.attempts, waiting.error) == ("queued", 1, "bucket unreachable")
    assert waiting.next_attempt_at == now + timedelta(minutes=2)
    assert await jobs.process_next(site.session, down, now=now) is None  # not due yet

    moment = now
    for _ in range(MAX_ATTEMPTS):
        moment += timedelta(hours=1)
        await jobs.process_next(site.session, down, now=moment)
    given_up = await refreshed(site.session, job)
    assert (given_up.status, given_up.attempts) == ("failed", MAX_ATTEMPTS)


async def test_a_renderer_bug_fails_only_its_job(
    site: Site, monkeypatch: pytest.MonkeyPatch
) -> None:
    job = await ask(site)

    async def broken(*_: object) -> bytes:
        raise ValueError("layout overflow")

    monkeypatch.setitem(jobs.RENDERERS, ReportKind.PHOTO, broken)
    await jobs.process_next(site.session, site.storage)

    failed = await refreshed(site.session, job)
    assert (failed.status, failed.error) == ("failed", "The report couldn't be made (ValueError)")
    assert await jobs.process_next(site.session, site.storage) is None  # the queue moved on


async def test_the_worker_renders_reports(site: Site) -> None:
    job = await ask(site)

    @asynccontextmanager
    async def sessions() -> AsyncIterator[AsyncSession]:
        yield site.session

    assert await Worker(sessions=sessions, storage=site.storage).drain() == 1
    assert (await refreshed(site.session, job)).status == JobStatus.READY
