"""Create equipment placements: units running in a claim's rooms.

Revision ID: a6056e827148
Revises: 87853ea68b59
Create Date: 2026-11-16 02:09:13.701919+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a6056e827148"
down_revision: str | None = "87853ea68b59"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "equipment_placements",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("claim_id", sa.Uuid(), nullable=False),
        sa.Column("room_id", sa.Uuid(), nullable=False),
        sa.Column("equipment_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(length=30), nullable=False),
        sa.Column("asset_tag", sa.String(length=40), nullable=False),
        sa.Column("placed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("removed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("placed_by_id", sa.Uuid(), nullable=True),
        sa.Column("removed_by_id", sa.Uuid(), nullable=True),
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
            "removed_at >= placed_at", name=op.f("ck_equipment_placements_removed_after_placed")
        ),
        sa.ForeignKeyConstraint(
            ["claim_id", "room_id"],
            ["rooms.claim_id", "rooms.id"],
            name=op.f("fk_equipment_placements_claim_id_rooms"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["claim_id"],
            ["claims.id"],
            name=op.f("fk_equipment_placements_claim_id_claims"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["equipment_id"],
            ["equipment.id"],
            name=op.f("fk_equipment_placements_equipment_id_equipment"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_equipment_placements_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["placed_by_id"],
            ["users.id"],
            name=op.f("fk_equipment_placements_placed_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["removed_by_id"],
            ["users.id"],
            name=op.f("fk_equipment_placements_removed_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_equipment_placements")),
    )
    op.create_index(
        "ix_equipment_placements_claim_id_placed_at",
        "equipment_placements",
        ["claim_id", "placed_at"],
        unique=False,
    )
    op.create_index(
        "ix_equipment_placements_claim_id_room_id",
        "equipment_placements",
        ["claim_id", "room_id"],
        unique=False,
    )
    op.create_index(
        "uq_equipment_placements_running",
        "equipment_placements",
        ["equipment_id"],
        unique=True,
        postgresql_where=sa.text("removed_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_equipment_placements_running",
        table_name="equipment_placements",
        postgresql_where=sa.text("removed_at IS NULL"),
    )
    op.drop_index("ix_equipment_placements_claim_id_room_id", table_name="equipment_placements")
    op.drop_index("ix_equipment_placements_claim_id_placed_at", table_name="equipment_placements")
    op.drop_table("equipment_placements")
