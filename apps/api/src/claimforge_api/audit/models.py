"""Audit events: who changed what, when."""

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from claimforge_api.db.base import Base
from claimforge_api.db.mixins import UUIDPrimaryKeyMixin


class AuditEvent(UUIDPrimaryKeyMixin, Base):
    """One recorded change. Rows are only ever inserted, never updated or deleted."""

    __tablename__ = "audit_events"

    # Null for changes outside any organization (e.g. a user editing their profile).
    organization_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), default=None
    )
    actor_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )
    action: Mapped[str] = mapped_column(String(100))  # e.g. "membership.updated"
    entity_type: Mapped[str] = mapped_column(String(50))
    entity_id: Mapped[UUID]
    # {"field": [before, after]}; secrets are redacted.
    changes: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    request_id: Mapped[str | None] = mapped_column(String(128), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        # Timeline queries: an organization's events, newest first.
        Index("ix_audit_events_org_timeline", "organization_id", "id"),
        Index("ix_audit_events_entity", "entity_type", "entity_id"),
    )
