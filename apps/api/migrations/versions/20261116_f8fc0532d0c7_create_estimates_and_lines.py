"""Create estimates and their lines.

Revision ID: f8fc0532d0c7
Revises: ac0850adc0a6
Create Date: 2026-11-16 03:52:34.194347+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f8fc0532d0c7"
down_revision: str | None = "ac0850adc0a6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "estimates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("claim_id", sa.Uuid(), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("price_list_id", sa.Uuid(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
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
        sa.CheckConstraint("btrim(title) <> ''", name=op.f("ck_estimates_title_not_blank")),
        sa.CheckConstraint(
            "status IN ('approved', 'draft', 'rejected', 'submitted')",
            name=op.f("ck_estimates_status_valid"),
        ),
        sa.CheckConstraint("number > 0", name=op.f("ck_estimates_number_positive")),
        sa.ForeignKeyConstraint(
            ["claim_id"],
            ["claims.id"],
            name=op.f("fk_estimates_claim_id_claims"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name=op.f("fk_estimates_created_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_estimates_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["price_list_id"],
            ["price_lists.id"],
            name=op.f("fk_estimates_price_list_id_price_lists"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_estimates")),
        sa.UniqueConstraint("claim_id", "id", name=op.f("uq_estimates_claim_id_id")),
        sa.UniqueConstraint("claim_id", "number", name=op.f("uq_estimates_claim_id_number")),
    )
    op.create_table(
        "estimate_lines",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("claim_id", sa.Uuid(), nullable=False),
        sa.Column("estimate_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("room_id", sa.Uuid(), nullable=True),
        sa.Column("price_item_id", sa.Uuid(), nullable=True),
        sa.Column("code", sa.String(length=40), nullable=True),
        sa.Column("description", sa.String(length=500), nullable=False),
        sa.Column("unit", sa.String(length=10), nullable=False),
        sa.Column("quantity", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("unit_price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
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
        sa.CheckConstraint("unit ~ '^[A-Z]{1,10}$'", name=op.f("ck_estimate_lines_unit_valid")),
        sa.CheckConstraint("position > 0", name=op.f("ck_estimate_lines_position_positive")),
        sa.CheckConstraint("quantity > 0", name=op.f("ck_estimate_lines_quantity_positive")),
        sa.CheckConstraint(
            "unit_price >= 0", name=op.f("ck_estimate_lines_unit_price_not_negative")
        ),
        sa.ForeignKeyConstraint(
            ["claim_id", "estimate_id"],
            ["estimates.claim_id", "estimates.id"],
            name=op.f("fk_estimate_lines_claim_id_estimates"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["claim_id", "room_id"],
            ["rooms.claim_id", "rooms.id"],
            name=op.f("fk_estimate_lines_claim_id_rooms"),
            ondelete="SET NULL (room_id)",
        ),
        sa.ForeignKeyConstraint(
            ["claim_id"],
            ["claims.id"],
            name=op.f("fk_estimate_lines_claim_id_claims"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_estimate_lines_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["price_item_id"],
            ["price_items.id"],
            name=op.f("fk_estimate_lines_price_item_id_price_items"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_estimate_lines")),
    )
    op.create_index(
        "ix_estimate_lines_claim_id_room_id",
        "estimate_lines",
        ["claim_id", "room_id"],
        unique=False,
    )
    op.create_index(
        "ix_estimate_lines_estimate_id_position",
        "estimate_lines",
        ["estimate_id", "position"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_estimate_lines_estimate_id_position", table_name="estimate_lines")
    op.drop_index("ix_estimate_lines_claim_id_room_id", table_name="estimate_lines")
    op.drop_table("estimate_lines")
    op.drop_table("estimates")
