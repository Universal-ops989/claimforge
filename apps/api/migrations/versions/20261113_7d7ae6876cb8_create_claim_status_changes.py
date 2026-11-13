"""Create claim_status_changes, the history of each claim's status.

Revision ID: 7d7ae6876cb8
Revises: a6dfbf43c96b
Create Date: 2026-11-13 17:22:21.903915+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "7d7ae6876cb8"
down_revision: str | None = "a6dfbf43c96b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "claim_status_changes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("claim_id", sa.Uuid(), nullable=False),
        sa.Column("from_status", sa.String(length=20), nullable=False),
        sa.Column("to_status", sa.String(length=20), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("changed_by_id", sa.Uuid(), nullable=True),
        sa.Column(
            "changed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "from_status IN ('new', 'inspected', 'in_progress', 'on_hold', "
            "'completed', 'closed', 'cancelled')",
            name=op.f("ck_claim_status_changes_from_status_valid"),
        ),
        sa.CheckConstraint(
            "to_status IN ('new', 'inspected', 'in_progress', 'on_hold', "
            "'completed', 'closed', 'cancelled')",
            name=op.f("ck_claim_status_changes_to_status_valid"),
        ),
        sa.CheckConstraint(
            "from_status <> to_status", name=op.f("ck_claim_status_changes_statuses_differ")
        ),
        sa.ForeignKeyConstraint(
            ["changed_by_id"],
            ["users.id"],
            name=op.f("fk_claim_status_changes_changed_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["claim_id"],
            ["claims.id"],
            name=op.f("fk_claim_status_changes_claim_id_claims"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_claim_status_changes_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_claim_status_changes")),
    )
    op.create_index(
        "ix_claim_status_changes_claim_id", "claim_status_changes", ["claim_id", "id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_claim_status_changes_claim_id", table_name="claim_status_changes")
    op.drop_table("claim_status_changes")
