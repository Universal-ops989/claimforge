"""Create report templates.

Revision ID: 11bbc16c886b
Revises: d24ae15f4d58
Create Date: 2026-11-16 04:49:59.251482+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "11bbc16c886b"
down_revision: str | None = "d24ae15f4d58"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "report_templates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(length=30), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=True),
        sa.Column("header_text", sa.Text(), nullable=True),
        sa.Column("footer_text", sa.Text(), nullable=True),
        sa.Column("accent_color", sa.String(length=7), nullable=False),
        sa.Column("options", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("is_default", sa.Boolean(), server_default=sa.text("false"), nullable=False),
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
            "accent_color ~ '^#[0-9A-Fa-f]{6}$'",
            name=op.f("ck_report_templates_accent_color_valid"),
        ),
        sa.CheckConstraint("btrim(name) <> ''", name=op.f("ck_report_templates_name_not_blank")),
        sa.CheckConstraint(
            "kind IN ('drying_report', 'photo_report')", name=op.f("ck_report_templates_kind_valid")
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_report_templates_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_report_templates")),
    )
    op.create_index(
        "uq_report_templates_default",
        "report_templates",
        ["organization_id", "kind"],
        unique=True,
        postgresql_where=sa.text("is_default"),
    )
    op.create_index(
        "uq_report_templates_organization_id_name",
        "report_templates",
        ["organization_id", sa.literal_column("lower(name)")],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_report_templates_organization_id_name", table_name="report_templates")
    op.drop_index(
        "uq_report_templates_default",
        table_name="report_templates",
        postgresql_where=sa.text("is_default"),
    )
    op.drop_table("report_templates")
