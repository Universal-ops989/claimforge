"""Create report jobs: reports queued for the worker to render.

Revision ID: 0e2e79121be7
Revises: 12c1f7c83d53
Create Date: 2026-11-16 06:17:12.361380+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0e2e79121be7"
down_revision: str | None = "12c1f7c83d53"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "report_jobs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("claim_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(length=30), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="queued", nullable=False),
        sa.Column("requested_by_id", sa.Uuid(), nullable=True),
        sa.Column("attempts", sa.SmallInteger(), server_default="0", nullable=False),
        sa.Column(
            "next_attempt_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("storage_key", sa.String(length=512), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("error", sa.String(length=500), nullable=True),
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
            "(status = 'ready') = (storage_key IS NOT NULL)",
            name=op.f("ck_report_jobs_ready_has_file"),
        ),
        sa.CheckConstraint(
            "kind IN ('drying_report', 'photo_report')", name=op.f("ck_report_jobs_kind_valid")
        ),
        sa.CheckConstraint(
            "status IN ('failed', 'queued', 'ready')", name=op.f("ck_report_jobs_status_valid")
        ),
        sa.ForeignKeyConstraint(
            ["claim_id"],
            ["claims.id"],
            name=op.f("fk_report_jobs_claim_id_claims"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_report_jobs_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["requested_by_id"],
            ["users.id"],
            name=op.f("fk_report_jobs_requested_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_report_jobs")),
    )
    op.create_index("ix_report_jobs_claim_id_id", "report_jobs", ["claim_id", "id"], unique=False)
    op.create_index(
        "ix_report_jobs_queue",
        "report_jobs",
        ["next_attempt_at"],
        unique=False,
        postgresql_where=sa.text("status = 'queued'"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_report_jobs_queue",
        table_name="report_jobs",
        postgresql_where=sa.text("status = 'queued'"),
    )
    op.drop_index("ix_report_jobs_claim_id_id", table_name="report_jobs")
    op.drop_table("report_jobs")
