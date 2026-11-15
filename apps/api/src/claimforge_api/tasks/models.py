"""Tasks: the to-do list on a claim, with due dates and assignees."""

from datetime import date, datetime
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from claimforge_api.claims.models import Claim
from claimforge_api.db.base import Base
from claimforge_api.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin
from claimforge_api.users.models import User


class Task(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tasks"
    __audited__ = True

    # Denormalized from the claim so tenant scoping and "my tasks" need no join.
    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    claim_id: Mapped[UUID] = mapped_column(ForeignKey("claims.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    # A day, not a moment: "by Friday" in the organization's time zone.
    due_on: Mapped[date | None] = mapped_column(Date, default=None)
    assignee_id: Mapped[UUID | None] = mapped_column(default=None)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    completed_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )
    created_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )

    claim: Mapped[Claim] = relationship(lazy="raise")
    assignee: Mapped[User | None] = relationship(
        primaryjoin="Task.assignee_id == User.id",
        foreign_keys=[assignee_id],
        viewonly=True,
        lazy="raise",
    )

    __table_args__ = (
        # Only members can be assigned. When one leaves, their tasks stay on the claim,
        # unassigned: SET NULL on just assignee_id (PostgreSQL 15+), since organization_id
        # is part of the key and can't be cleared.
        ForeignKeyConstraint(
            ["organization_id", "assignee_id"],
            ["memberships.organization_id", "memberships.user_id"],
            ondelete="SET NULL (assignee_id)",
        ),
        # completed_by_id alone can go null (the user's account is deleted); never the reverse.
        CheckConstraint(
            "completed_by_id IS NULL OR completed_at IS NOT NULL", name="completed_by_needs_done"
        ),
        CheckConstraint("length(btrim(title)) > 0", name="title_not_blank"),
        # A claim's tasks, and "assigned to me" over open tasks by due date.
        Index("ix_tasks_claim_id", "claim_id"),
        Index(
            "ix_tasks_organization_id_assignee_id_open",
            "organization_id",
            "assignee_id",
            "due_on",
            "id",
            postgresql_where=text("completed_at IS NULL"),
        ),
    )

    @property
    def done(self) -> bool:
        return self.completed_at is not None
