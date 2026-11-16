"""Create price lists and their items.

Revision ID: e50fa3e4cc09
Revises: 27c809372050
Create Date: 2026-11-16 03:21:52.804440+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e50fa3e4cc09"
down_revision: str | None = "27c809372050"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "price_lists",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("effective_on", sa.Date(), nullable=True),
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
        sa.CheckConstraint("btrim(name) <> ''", name=op.f("ck_price_lists_name_not_blank")),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_price_lists_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_price_lists")),
    )
    op.create_index(
        "uq_price_lists_default",
        "price_lists",
        ["organization_id"],
        unique=True,
        postgresql_where=sa.text("is_default"),
    )
    op.create_index(
        "uq_price_lists_organization_id_name",
        "price_lists",
        ["organization_id", sa.literal_column("lower(name)")],
        unique=True,
    )
    op.create_table(
        "price_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("price_list_id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=40), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=False),
        sa.Column("unit", sa.String(length=10), nullable=False),
        sa.Column("unit_price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("category", sa.String(length=40), nullable=True),
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
        sa.CheckConstraint("btrim(code) <> ''", name=op.f("ck_price_items_code_not_blank")),
        sa.CheckConstraint("unit ~ '^[A-Z]{1,10}$'", name=op.f("ck_price_items_unit_valid")),
        sa.CheckConstraint("unit_price >= 0", name=op.f("ck_price_items_unit_price_not_negative")),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_price_items_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["price_list_id"],
            ["price_lists.id"],
            name=op.f("fk_price_items_price_list_id_price_lists"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_price_items")),
    )
    op.create_index(
        "ix_price_items_price_list_id_category",
        "price_items",
        ["price_list_id", "category"],
        unique=False,
    )
    op.create_index(
        "uq_price_items_price_list_id_code",
        "price_items",
        ["price_list_id", sa.literal_column("lower(code)")],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_price_items_price_list_id_code", table_name="price_items")
    op.drop_index("ix_price_items_price_list_id_category", table_name="price_items")
    op.drop_table("price_items")
    op.drop_index("uq_price_lists_organization_id_name", table_name="price_lists")
    op.drop_index(
        "uq_price_lists_default", table_name="price_lists", postgresql_where=sa.text("is_default")
    )
    op.drop_table("price_lists")
