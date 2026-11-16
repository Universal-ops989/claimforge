"""Create the equipment inventory.

Revision ID: 87853ea68b59
Revises: 3fbfd15a1b75
Create Date: 2026-11-16 01:54:02.679959+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "87853ea68b59"
down_revision: str | None = "3fbfd15a1b75"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "equipment",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(length=30), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("asset_tag", sa.String(length=40), nullable=False),
        sa.Column("serial_number", sa.String(length=100), nullable=True),
        sa.Column("capacity", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
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
        sa.CheckConstraint("btrim(asset_tag) <> ''", name=op.f("ck_equipment_asset_tag_not_blank")),
        sa.CheckConstraint(
            "kind IN ('air_mover', 'air_scrubber', 'dehumidifier', 'desiccant_dehumidifier', "
            "'heater', 'other')",
            name=op.f("ck_equipment_kind_valid"),
        ),
        sa.CheckConstraint(
            "status IN ('in_service', 'maintenance', 'retired')",
            name=op.f("ck_equipment_status_valid"),
        ),
        sa.CheckConstraint("capacity > 0", name=op.f("ck_equipment_capacity_positive")),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_equipment_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_equipment")),
    )
    op.create_index(
        "ix_equipment_organization_id_kind", "equipment", ["organization_id", "kind"], unique=False
    )
    op.create_index(
        "uq_equipment_organization_id_asset_tag",
        "equipment",
        ["organization_id", sa.literal_column("lower(asset_tag)")],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_equipment_organization_id_asset_tag", table_name="equipment")
    op.drop_index("ix_equipment_organization_id_kind", table_name="equipment")
    op.drop_table("equipment")
