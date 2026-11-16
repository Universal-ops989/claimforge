"""Report templates: how an organization's reports look, kind by kind."""

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from claimforge_api.db.base import Base
from claimforge_api.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin
from claimforge_api.users.models import User

DEFAULT_ACCENT = "#1F4E79"
ERROR_LENGTH = 500


class ReportKind(StrEnum):
    PHOTO = "photo_report"
    DRYING = "drying_report"


def _in(column: str, values: type[StrEnum]) -> str:
    return f"{column} IN ({', '.join(sorted(repr(v.value) for v in values))})"


class ReportTemplate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "report_templates"
    __audited__ = True

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    #: Fixed once created: the options belong to the kind.
    kind: Mapped[ReportKind] = mapped_column(String(30))
    name: Mapped[str] = mapped_column(String(100))
    #: On the cover: "Photo Report", "Drying Log".
    title: Mapped[str | None] = mapped_column(String(200), default=None)
    #: Company name, address, phone: the top of every page.
    header_text: Mapped[str | None] = mapped_column(Text, default=None)
    #: Licence numbers, disclaimers: the bottom of every page.
    footer_text: Mapped[str | None] = mapped_column(Text, default=None)
    accent_color: Mapped[str] = mapped_column(String(7), default=DEFAULT_ACCENT)
    #: Checked against the kind's options schema (reports/schemas.py) before it's stored.
    options: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    #: Where the logo (a PNG, see reports/logos.py) is stored, if there is one.
    logo_key: Mapped[str | None] = mapped_column(String(512), default=None)

    __table_args__ = (
        Index(
            "uq_report_templates_organization_id_name",
            "organization_id",
            func.lower(name),
            unique=True,
        ),
        # At most one default per kind.
        Index(
            "uq_report_templates_default",
            "organization_id",
            "kind",
            unique=True,
            postgresql_where=text("is_default"),
        ),
        CheckConstraint(_in("kind", ReportKind), name="kind_valid"),
        CheckConstraint("accent_color ~ '^#[0-9A-Fa-f]{6}$'", name="accent_color_valid"),
        CheckConstraint("btrim(name) <> ''", name="name_not_blank"),
    )


class JobStatus(StrEnum):
    #: Until it's done: a worker renders it inside one locked transaction, so a worker
    #: that dies mid-render leaves it queued (and retried), never stuck half-way.
    QUEUED = "queued"
    READY = "ready"
    FAILED = "failed"


def report_key(organization_id: UUID, claim_id: UUID, job_id: UUID) -> str:
    return f"organizations/{organization_id}/claims/{claim_id}/reports/{job_id}.pdf"


class ReportJob(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "report_jobs"
    __audited__ = True

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    claim_id: Mapped[UUID] = mapped_column(ForeignKey("claims.id", ondelete="CASCADE"))
    kind: Mapped[ReportKind] = mapped_column(String(30))
    status: Mapped[JobStatus] = mapped_column(
        String(20), default=JobStatus.QUEUED, server_default=JobStatus.QUEUED
    )
    #: Whose access the report is rendered with. A job whose member is gone can't run.
    requested_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )
    attempts: Mapped[int] = mapped_column(SmallInteger, default=0, server_default="0")
    next_attempt_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    storage_key: Mapped[str | None] = mapped_column(String(512), default=None)
    size_bytes: Mapped[int | None] = mapped_column(Integer, default=None)
    error: Mapped[str | None] = mapped_column(String(ERROR_LENGTH), default=None)

    requested_by: Mapped[User | None] = relationship(lazy="raise")

    __table_args__ = (
        CheckConstraint(_in("kind", ReportKind), name="kind_valid"),
        CheckConstraint(_in("status", JobStatus), name="status_valid"),
        CheckConstraint("(status = 'ready') = (storage_key IS NOT NULL)", name="ready_has_file"),
        # The worker's queue: queued jobs, soonest first.
        Index(
            "ix_report_jobs_queue",
            "next_attempt_at",
            postgresql_where=text("status = 'queued'"),
        ),
        Index("ix_report_jobs_claim_id_id", "claim_id", "id"),
    )


class ReportShare(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A link to one report that works without signing in, until it expires."""

    __tablename__ = "report_shares"
    __audited__ = True

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    claim_id: Mapped[UUID] = mapped_column(ForeignKey("claims.id", ondelete="CASCADE"))
    report_id: Mapped[UUID] = mapped_column(ForeignKey("report_jobs.id", ondelete="CASCADE"))
    #: SHA-256 of the link's token: the token itself is shown once and never stored.
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    label: Mapped[str | None] = mapped_column(String(200), default=None)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    created_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )
    # Kept up to date outside the ORM (see reports/shares.py): every open by a carrier
    # would otherwise be an audit event.
    open_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    last_opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    created_by: Mapped[User | None] = relationship(lazy="raise")

    __table_args__ = (Index("ix_report_shares_report_id", "report_id"),)
