"""Report jobs: reports are rendered in the background, then downloaded.

:func:`request` records a queued job; the worker calls :func:`process_next`, which takes
the next due job with ``FOR UPDATE SKIP LOCKED`` (any number of workers share the queue),
renders it with the requesting member's access, stores the PDF and marks the job ready.
Storage outages back off and retry; anything else fails the job with its reason.
"""

import logging
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from claimforge_api.auth.permissions import Permission, authorize
from claimforge_api.claims import service as claims
from claimforge_api.claims.models import Claim
from claimforge_api.claims.schemas import ClaimActor
from claimforge_api.core.errors import AppError, NotFoundError
from claimforge_api.photos.processing import MAX_ATTEMPTS, backoff
from claimforge_api.reports import drying_report, photo_report
from claimforge_api.reports.models import (
    ERROR_LENGTH,
    JobStatus,
    ReportJob,
    ReportKind,
    report_key,
)
from claimforge_api.reports.schemas import TITLES, ReportJobRead
from claimforge_api.storage.base import ObjectStorage, StorageUnavailableError
from claimforge_api.users.models import User

logger = logging.getLogger(__name__)

PDF = "application/pdf"
#: How long a download link works.
LINK_LIFETIME = timedelta(hours=1)


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
    # The job is only touched once the outcome is known: the renderer's queries flush the
    # session, and an early change would reach the audit log as an update of its own.
    job_id, kind = job.id, ReportKind(job.kind)
    org_id, claim_id = job.organization_id, job.claim_id
    user = await session.get(User, job.requested_by_id) if job.requested_by_id else None
    retry: StorageUnavailableError | None = None
    reason: str | None = None
    if user is None:
        reason = "The member who asked for this report is gone"
    else:
        try:
            pdf = await RENDERERS[kind](session, storage, org_id, claim_id, user)
            key = report_key(org_id, claim_id, job_id)
            await storage.put(key, pdf, content_type=PDF)
        except StorageUnavailableError as error:
            retry = error
        except AppError as error:  # the member lost access, the claim was deleted …
            reason = error.detail
        except Exception as error:
            logger.exception("Report job %s failed", job_id)
            reason = f"The report couldn't be made ({type(error).__name__})"
        if retry is not None or reason is not None:
            # The renderer may have left the session mid-read: start clean, lock again.
            await session.rollback()
            job = await session.get_one(ReportJob, job_id, with_for_update=True)
    job.attempts += 1
    job.started_at = now
    if retry is not None:
        if job.attempts >= MAX_ATTEMPTS:
            _fail(job, f"Storage unavailable: {retry}", now)
        else:
            job.error = str(retry)[:ERROR_LENGTH]
            job.next_attempt_at = now + backoff(job.attempts)
    elif reason is not None:
        _fail(job, reason, now)
    else:
        job.status = JobStatus.READY
        job.storage_key = key
        job.size_bytes = len(pdf)
        job.error = None
        job.finished_at = now
    await session.commit()
    return job_id


# ─── Reading and deleting ─────────────────────────────────────────────────────


def _jobs(organization_id: UUID, claim_id: UUID) -> Select[ReportJob]:
    return (
        select(ReportJob)
        .where(ReportJob.claim_id == claim_id, ReportJob.organization_id == organization_id)
        .options(selectinload(ReportJob.requested_by))
        .execution_options(populate_existing=True)
    )


async def _get(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, job_id: UUID
) -> ReportJob:
    job = await session.scalar(_jobs(organization_id, claim_id).where(ReportJob.id == job_id))
    if job is None:
        raise NotFoundError("Report not found", report_id=str(job_id))
    return job


def filename(kind: ReportKind, claim_number: str) -> str:
    """What a downloaded report is saved as: "Photo Report 2026-00042.pdf"."""
    return f"{TITLES[kind]} {claim_number}.pdf"


async def present(session: AsyncSession, storage: ObjectStorage, job: ReportJob) -> ReportJobRead:
    url = None
    if job.status == JobStatus.READY and job.storage_key is not None:
        number = (
            await session.execute(select(Claim.number).where(Claim.id == job.claim_id))
        ).scalar_one()
        url = await storage.download_url(
            job.storage_key,
            expires_in=LINK_LIFETIME,
            filename=filename(ReportKind(job.kind), number),
        )
    return ReportJobRead(
        id=job.id,
        claim_id=job.claim_id,
        kind=job.kind,
        status=job.status,
        requested_by=ClaimActor.model_validate(job.requested_by) if job.requested_by else None,
        created_at=job.created_at,
        finished_at=job.finished_at,
        size_bytes=job.size_bytes,
        error=job.error,
        download_url=url,
    )


async def list_jobs(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, *, user: User
) -> list[ReportJob]:
    """A claim's reports, newest first."""
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    await claims.require_live(session, organization_id, claim_id)
    return list(
        await session.scalars(_jobs(organization_id, claim_id).order_by(ReportJob.id.desc()))
    )


async def get_job(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, job_id: UUID, *, user: User
) -> ReportJob:
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    await claims.require_live(session, organization_id, claim_id)
    return await _get(session, organization_id, claim_id, job_id)


async def delete_job(
    session: AsyncSession,
    storage: ObjectStorage,
    organization_id: UUID,
    claim_id: UUID,
    job_id: UUID,
    *,
    user: User,
) -> None:
    """Delete a report and its file (a queued one simply won't be made)."""
    await authorize(session, user, organization_id, Permission.REPORTS_GENERATE)
    await claims.require_live(session, organization_id, claim_id)
    job = await _get(session, organization_id, claim_id, job_id)
    key = job.storage_key
    await session.delete(job)
    await session.commit()
    if key is not None:
        try:
            await storage.delete(key)
        except StorageUnavailableError:
            logger.warning("Report %s deleted but its file %s remains", job_id, key, exc_info=True)
