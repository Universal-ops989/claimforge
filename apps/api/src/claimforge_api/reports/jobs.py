"""Report jobs: reports are rendered in the background, then downloaded.

:func:`request` records a queued job; the worker calls :func:`process_next`, which takes
the next due job with ``FOR UPDATE SKIP LOCKED`` (any number of workers share the queue),
renders it with the requesting member's access, stores the PDF and marks the job ready.
Storage outages back off and retry; anything else fails the job with its reason.
"""

import logging
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.auth.permissions import Permission, authorize
from claimforge_api.claims import service as claims
from claimforge_api.core.errors import AppError
from claimforge_api.photos.processing import MAX_ATTEMPTS, backoff
from claimforge_api.reports import drying_report, photo_report
from claimforge_api.reports.models import (
    ERROR_LENGTH,
    JobStatus,
    ReportJob,
    ReportKind,
    report_key,
)
from claimforge_api.storage.base import ObjectStorage, StorageUnavailableError
from claimforge_api.users.models import User

logger = logging.getLogger(__name__)

PDF = "application/pdf"


Renderer = Callable[[AsyncSession, ObjectStorage, UUID, UUID, User], Awaitable[bytes]]


async def _photo(
    session: AsyncSession, storage: ObjectStorage, org: UUID, claim: UUID, user: User
) -> bytes:
    return await photo_report.render(session, storage, org, claim, prepared_by=user)


async def _drying(
    session: AsyncSession, storage: ObjectStorage, org: UUID, claim: UUID, user: User
) -> bytes:
    return await drying_report.render(session, storage, org, claim, user=user)


RENDERERS: dict[ReportKind, Renderer] = {ReportKind.PHOTO: _photo, ReportKind.DRYING: _drying}


async def request(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, kind: ReportKind, *, user: User
) -> ReportJob:
    """Queue a report. Closed claims can have reports too: that's when carriers ask."""
    await authorize(session, user, organization_id, Permission.REPORTS_GENERATE)
    await claims.require_live(session, organization_id, claim_id)
    job = ReportJob(
        organization_id=organization_id, claim_id=claim_id, kind=kind, requested_by_id=user.id
    )
    session.add(job)
    await session.commit()
    await session.refresh(job)
    return job


def _fail(job: ReportJob, reason: str, now: datetime) -> None:
    job.status = JobStatus.FAILED
    job.error = reason[:ERROR_LENGTH]
    job.finished_at = now


async def process_next(
    session: AsyncSession, storage: ObjectStorage, *, now: datetime | None = None
) -> UUID | None:
    """Render the next due report. Its job's id, or ``None`` when none is waiting."""
    now = now or datetime.now(UTC)
    job = await session.scalar(
        select(ReportJob)
        .where(ReportJob.status == JobStatus.QUEUED, ReportJob.next_attempt_at <= now)
        .order_by(ReportJob.next_attempt_at, ReportJob.id)
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    if job is None:
        return None
    job_id = job.id
    job.attempts += 1
    job.started_at = now
    user = await session.get(User, job.requested_by_id) if job.requested_by_id else None
    if user is None:
        _fail(job, "The member who asked for this report is gone", now)
        await session.commit()
        return job_id
    try:
        pdf = await RENDERERS[ReportKind(job.kind)](
            session, storage, job.organization_id, job.claim_id, user
        )
        key = report_key(job.organization_id, job.claim_id, job.id)
        await storage.put(key, pdf, content_type=PDF)
    except StorageUnavailableError as error:
        await session.rollback()  # the renderer may have left the session mid-read
        job = await session.get_one(ReportJob, job_id, with_for_update=True)
        job.attempts += 1
        if job.attempts >= MAX_ATTEMPTS:
            _fail(job, f"Storage unavailable: {error}", now)
        else:
            job.error = str(error)[:ERROR_LENGTH]
            job.next_attempt_at = now + backoff(job.attempts)
    except AppError as error:  # the member lost access, the claim was deleted …
        await session.rollback()
        job = await session.get_one(ReportJob, job_id, with_for_update=True)
        job.attempts += 1
        _fail(job, error.detail, now)
    except Exception as error:
        logger.exception("Report job %s failed", job_id)
        await session.rollback()
        job = await session.get_one(ReportJob, job_id, with_for_update=True)
        job.attempts += 1
        _fail(job, f"The report couldn't be made ({type(error).__name__})", now)
    else:
        job.status = JobStatus.READY
        job.storage_key = key
        job.size_bytes = len(pdf)
        job.error = None
        job.finished_at = now
    await session.commit()
    return job_id
