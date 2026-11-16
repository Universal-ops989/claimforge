"""Links that let someone outside the organization download one report, for a while.

The link's token is shown once, when the link is made; only its SHA-256 is stored, so a
database leak exposes no working links. Opening a link that's expired, revoked or unknown
answers the same 404: a link says nothing about whether it ever existed.
"""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import Select, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from claimforge_api.auth.permissions import Permission, authorize
from claimforge_api.claims import service as claims
from claimforge_api.claims.models import Claim
from claimforge_api.claims.schemas import ClaimActor
from claimforge_api.core.errors import ConflictError, NotFoundError
from claimforge_api.reports import jobs
from claimforge_api.reports.models import JobStatus, ReportJob, ReportKind, ReportShare
from claimforge_api.reports.schemas import ShareCreate, ShareCreated, ShareRead
from claimforge_api.storage.base import ObjectStorage
from claimforge_api.users.models import User

#: The download a link redirects to only has to last until the browser follows it.
DOWNLOAD_LIFETIME = timedelta(minutes=5)
PUBLIC_PATH = "/v1/shared-reports/"


class ReportNotReadyError(ConflictError):
    code = "report_not_ready"
    title = "Only a ready report can be shared"


class ShareNotFoundError(NotFoundError):
    code = "share_not_found"
    title = "This link doesn't work"


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def is_active(share: ReportShare, now: datetime) -> bool:
    return share.revoked_at is None and share.expires_at > now


def present(share: ReportShare, *, now: datetime | None = None) -> ShareRead:
    return ShareRead(
        id=share.id,
        report_id=share.report_id,
        label=share.label,
        expires_at=share.expires_at,
        revoked_at=share.revoked_at,
        active=is_active(share, now or datetime.now(UTC)),
        open_count=share.open_count,
        last_opened_at=share.last_opened_at,
        created_by=ClaimActor.model_validate(share.created_by) if share.created_by else None,
        created_at=share.created_at,
    )


def _shares(organization_id: UUID, claim_id: UUID, report_id: UUID) -> Select[ReportShare]:
    return (
        select(ReportShare)
        .where(
            ReportShare.organization_id == organization_id,
            ReportShare.claim_id == claim_id,
            ReportShare.report_id == report_id,
        )
        .options(selectinload(ReportShare.created_by))
        .execution_options(populate_existing=True)
    )


async def create(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    report_id: UUID,
    data: ShareCreate,
    *,
    base_url: str,
    user: User,
) -> ShareCreated:
    """A new link to a ready report. Its URL is in the answer and nowhere else."""
    await authorize(session, user, organization_id, Permission.REPORTS_GENERATE)
    report = await jobs.get_job(session, organization_id, claim_id, report_id, user=user)
    if report.status != JobStatus.READY:
        raise ReportNotReadyError(report_status=str(report.status))
    raw = secrets.token_urlsafe(32)
    share = ReportShare(
        organization_id=organization_id,
        claim_id=claim_id,
        report_id=report.id,
        token_hash=hash_token(raw),
        label=data.label,
        expires_at=datetime.now(UTC) + timedelta(days=data.expires_in_days),
        created_by_id=user.id,
    )
    session.add(share)
    await session.commit()
    share = (
        await session.scalars(
            _shares(organization_id, claim_id, report_id).where(ReportShare.id == share.id)
        )
    ).one()
    url = f"{base_url.rstrip('/')}{PUBLIC_PATH}{raw}"
    return ShareCreated(**present(share).model_dump(), url=url)


async def list_shares(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, report_id: UUID, *, user: User
) -> list[ReportShare]:
    """A report's links, newest first, revoked and expired ones included."""
    await jobs.get_job(session, organization_id, claim_id, report_id, user=user)
    return list(
        await session.scalars(
            _shares(organization_id, claim_id, report_id).order_by(ReportShare.id.desc())
        )
    )


async def revoke(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    report_id: UUID,
    share_id: UUID,
    *,
    user: User,
) -> ReportShare:
    await authorize(session, user, organization_id, Permission.REPORTS_GENERATE)
    await claims.require_live(session, organization_id, claim_id)
    share = await session.scalar(
        _shares(organization_id, claim_id, report_id).where(ReportShare.id == share_id)
    )
    if share is None:
        raise NotFoundError("Link not found", share_id=str(share_id))
    if share.revoked_at is None:
        share.revoked_at = datetime.now(UTC)
        await session.commit()
    return share


async def open_link(
    session: AsyncSession, storage: ObjectStorage, token: str, *, now: datetime | None = None
) -> str:
    """Where a link sends its visitor: a short-lived download. Counts the open."""
    now = now or datetime.now(UTC)
    row = (
        await session.execute(
            select(ReportShare, ReportJob, Claim.number)
            .join(ReportJob, ReportJob.id == ReportShare.report_id)
            .join(Claim, Claim.id == ReportShare.claim_id)
            .where(ReportShare.token_hash == hash_token(token), Claim.not_deleted())
        )
    ).first()
    if row is None:
        raise ShareNotFoundError()
    share, report, number = row
    if not is_active(share, now) or report.storage_key is None:
        raise ShareNotFoundError()
    # Outside the ORM on purpose: an audit event per carrier click would bury the history.
    await session.execute(
        update(ReportShare)
        .where(ReportShare.id == share.id)
        .values(open_count=ReportShare.open_count + 1, last_opened_at=now)
        .execution_options(synchronize_session=False)
    )
    await session.commit()
    return await storage.download_url(
        report.storage_key,
        expires_in=DOWNLOAD_LIFETIME,
        filename=jobs.filename(ReportKind(report.kind), number),
    )
