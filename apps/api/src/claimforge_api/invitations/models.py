"""Pending invitations to join an organization."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from claimforge_api.db.base import Base
from claimforge_api.db.mixins import UUIDPrimaryKeyMixin
from claimforge_api.organizations.models import Organization
from claimforge_api.users.models import Role


class Invitation(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "invitations"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    email: Mapped[str] = mapped_column(String(254))
    role: Mapped[Role] = mapped_column(String(20))
    # SHA-256 of the random token in the emailed link; the raw token is never stored.
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    invited_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    organization: Mapped[Organization] = relationship()

    __table_args__ = (
        CheckConstraint(
            "role IN ('owner', 'admin', 'adjuster', 'technician', 'viewer')", name="role_valid"
        ),
        # At most one open invitation per person per organization.
        Index(
            "uq_invitations_pending_email",
            "organization_id",
            func.lower(email),
            unique=True,
            postgresql_where=text("accepted_at IS NULL AND revoked_at IS NULL"),
        ),
    )

    @property
    def is_pending(self) -> bool:
        return self.accepted_at is None and self.revoked_at is None
