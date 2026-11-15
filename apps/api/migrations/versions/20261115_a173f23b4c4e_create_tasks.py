"""Create tasks: the to-do list on a claim, with due dates and assignees.

Revision ID: a173f23b4c4e
Revises: 1dc5a6d3dbec
Create Date: 2026-11-15 18:27:07.060514+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a173f23b4c4e"
down_revision: str | None = "1dc5a6d3dbec"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "tasks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("claim_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("due_on", sa.Date(), nullable=True),
        sa.Column("assignee_id", sa.Uuid(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_by_id", sa.Uuid(), nullable=True),
        sa.Column("created_by_id", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "completed_by_id IS NULL OR completed_at IS NOT NULL",
            name=op.f("ck_tasks_completed_by_needs_done"),
        ),
        sa.CheckConstraint("length(btrim(title)) > 0", name=op.f("ck_tasks_title_not_blank")),
        sa.ForeignKeyConstraint(
            ["claim_id"], ["claims.id"], name=op.f("fk_tasks_claim_id_claims"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["completed_by_id"],
            ["users.id"],
            name=op.f("fk_tasks_completed_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name=op.f("fk_tasks_created_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "assignee_id"],
            ["memberships.organization_id", "memberships.user_id"],
            name=op.f("fk_tasks_organization_id_memberships"),
            ondelete="SET NULL (assignee_id)",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_tasks_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tasks")),
    )
    op.create_index("ix_tasks_claim_id", "tasks", ["claim_id"], unique=False)
    op.create_index(
        "ix_tasks_organization_id_assignee_id_open",
        "tasks",
        ["organization_id", "assignee_id", "due_on", "id"],
        unique=False,
        postgresql_where=sa.text("completed_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_tasks_organization_id_assignee_id_open",
        table_name="tasks",
        postgresql_where=sa.text("completed_at IS NULL"),
    )
    op.drop_index("ix_tasks_claim_id", table_name="tasks")
    op.drop_table("tasks")
