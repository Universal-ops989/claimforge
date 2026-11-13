"""Create claim_assignments: members working a claim as adjuster, contractor or field tech.

Revision ID: fd7838d5d9e6
Revises: 7d7ae6876cb8
Create Date: 2026-11-13 18:06:22.338003+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "fd7838d5d9e6"
down_revision: str | None = "7d7ae6876cb8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "claim_assignments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("claim_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("assigned_by_id", sa.Uuid(), nullable=True),
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
            "role IN ('adjuster', 'contractor', 'field_technician')",
            name=op.f("ck_claim_assignments_role_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["assigned_by_id"],
            ["users.id"],
            name=op.f("fk_claim_assignments_assigned_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["claim_id"],
            ["claims.id"],
            name=op.f("fk_claim_assignments_claim_id_claims"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "user_id"],
            ["memberships.organization_id", "memberships.user_id"],
            name=op.f("fk_claim_assignments_organization_id_memberships"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_claim_assignments_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_claim_assignments_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_claim_assignments")),
        sa.UniqueConstraint(
            "claim_id", "user_id", name=op.f("uq_claim_assignments_claim_id_user_id")
        ),
    )
    op.create_index(
        "ix_claim_assignments_organization_id_user_id",
        "claim_assignments",
        ["organization_id", "user_id"],
        unique=False,
    )
    op.create_index(
        "uq_claim_assignments_adjuster",
        "claim_assignments",
        ["claim_id"],
        unique=True,
        postgresql_where=sa.text("role = 'adjuster'"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_claim_assignments_adjuster",
        table_name="claim_assignments",
        postgresql_where=sa.text("role = 'adjuster'"),
    )
    op.drop_index("ix_claim_assignments_organization_id_user_id", table_name="claim_assignments")
    op.drop_table("claim_assignments")
