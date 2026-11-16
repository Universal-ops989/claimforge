"""Create moisture logs (monitoring visits) and their readings.

Revision ID: 3fbfd15a1b75
Revises: 3f4738107b93
Create Date: 2026-11-16 00:56:29.663972+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "3fbfd15a1b75"
down_revision: str | None = "3f4738107b93"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "moisture_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("claim_id", sa.Uuid(), nullable=False),
        sa.Column("taken_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("taken_by_id", sa.Uuid(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("readings_edited_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["claim_id"],
            ["claims.id"],
            name=op.f("fk_moisture_logs_claim_id_claims"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_moisture_logs_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["taken_by_id"],
            ["users.id"],
            name=op.f("fk_moisture_logs_taken_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_moisture_logs")),
        sa.UniqueConstraint("claim_id", "id", name=op.f("uq_moisture_logs_claim_id_id")),
    )
    op.create_index(
        "ix_moisture_logs_claim_id_taken_at",
        "moisture_logs",
        ["claim_id", "taken_at"],
        unique=False,
    )
    op.create_table(
        "moisture_readings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("claim_id", sa.Uuid(), nullable=False),
        sa.Column("log_id", sa.Uuid(), nullable=False),
        sa.Column("point_id", sa.Uuid(), nullable=False),
        sa.Column("value", sa.Numeric(precision=5, scale=1), nullable=False),
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
        sa.CheckConstraint("value >= 0", name=op.f("ck_moisture_readings_value_not_negative")),
        sa.ForeignKeyConstraint(
            ["claim_id", "log_id"],
            ["moisture_logs.claim_id", "moisture_logs.id"],
            name=op.f("fk_moisture_readings_claim_id_moisture_logs"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["claim_id", "point_id"],
            ["moisture_points.claim_id", "moisture_points.id"],
            name=op.f("fk_moisture_readings_claim_id_moisture_points"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["claim_id"],
            ["claims.id"],
            name=op.f("fk_moisture_readings_claim_id_claims"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_moisture_readings_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_moisture_readings")),
        sa.UniqueConstraint(
            "log_id", "point_id", name=op.f("uq_moisture_readings_log_id_point_id")
        ),
    )
    op.create_index(
        "ix_moisture_readings_point_id", "moisture_readings", ["point_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_moisture_readings_point_id", table_name="moisture_readings")
    op.drop_table("moisture_readings")
    op.drop_index("ix_moisture_logs_claim_id_taken_at", table_name="moisture_logs")
    op.drop_table("moisture_logs")
