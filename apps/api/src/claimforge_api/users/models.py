"""Users and their memberships in organizations."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from claimforge_api.db.base import Base
from claimforge_api.db.mixins import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from claimforge_api.organizations.models import Organization


class Role(StrEnum):
    """What a member can do in an organization (permissions are defined in the RBAC module)."""

    OWNER = "owner"
    ADMIN = "admin"
    ADJUSTER = "adjuster"
    TECHNICIAN = "technician"
    VIEWER = "viewer"


class User(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    """A person who signs in. Global: one user can belong to many organizations."""

    __tablename__ = "users"
    __audited__ = True

    email: Mapped[str] = mapped_column(String(254))
    full_name: Mapped[str] = mapped_column(String(200))
    # Null until the user sets a password (e.g. an invitation not yet accepted).
    password_hash: Mapped[str | None] = mapped_column(String(255), default=None)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    memberships: Mapped[list["Membership"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    __table_args__ = (
        # Case-insensitive uniqueness without the citext extension.
        Index(
            "uq_users_email_live",
            func.lower(email),
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    def __repr__(self) -> str:
        return f"<User {self.email}>"


class Membership(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A user's role in one organization."""

    __tablename__ = "memberships"
    __audited__ = True

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[Role] = mapped_column(String(20))

    user: Mapped[User] = relationship(back_populates="memberships")
    organization: Mapped[Organization] = relationship()

    __table_args__ = (
        UniqueConstraint("organization_id", "user_id"),
        CheckConstraint(
            "role IN ('owner', 'admin', 'adjuster', 'technician', 'viewer')", name="role_valid"
        ),
    )
