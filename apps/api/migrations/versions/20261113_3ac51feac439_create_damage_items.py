"""Create damage_items: damaged materials per room, with cause and water category/class.

Revision ID: 3ac51feac439
Revises: b8fe6edb7dfa
Create Date: 2026-11-13 22:28:47.492866+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "3ac51feac439"
down_revision: str | None = "b8fe6edb7dfa"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # The damage items' composite foreign key points at it.
    op.create_unique_constraint(op.f("uq_rooms_claim_id_id"), "rooms", ["claim_id", "id"])
    op.create_table(
        "damage_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("claim_id", sa.Uuid(), nullable=False),
        sa.Column("room_id", sa.Uuid(), nullable=False),
        sa.Column("surface", sa.String(length=20), nullable=False),
        sa.Column("material", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cause", sa.String(length=20), nullable=False),
        sa.Column("water_category", sa.SmallInteger(), nullable=True),
        sa.Column("water_class", sa.SmallInteger(), nullable=True),
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
            "NOT cause IN ('flood', 'sewage') OR water_category IS NOT DISTINCT FROM 3",
            name=op.f("ck_damage_items_black_water_is_category_3"),
        ),
        sa.CheckConstraint(
            "cause IN ('fire', 'flood', 'hail', 'impact', 'mold', 'other', 'sewage', 'smoke', "
            "'storm', 'vandalism', 'water', 'wind')",
            name=op.f("ck_damage_items_cause_valid"),
        ),
        sa.CheckConstraint(
            "cause IN ('flood', 'sewage', 'storm', 'water') "
            "OR (water_category IS NULL AND water_class IS NULL)",
            name=op.f("ck_damage_items_water_details_need_water"),
        ),
        sa.CheckConstraint(
            "surface IN ('cabinetry', 'ceiling', 'contents', 'fixture', 'floor', 'other', "
            "'trim', 'wall')",
            name=op.f("ck_damage_items_surface_valid"),
        ),
        sa.CheckConstraint(
            "water_category BETWEEN 1 AND 3", name=op.f("ck_damage_items_water_category_valid")
        ),
        sa.CheckConstraint(
            "water_class BETWEEN 1 AND 4", name=op.f("ck_damage_items_water_class_valid")
        ),
        sa.ForeignKeyConstraint(
            ["claim_id", "room_id"],
            ["rooms.claim_id", "rooms.id"],
            name=op.f("fk_damage_items_claim_id_rooms"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["claim_id"],
            ["claims.id"],
            name=op.f("fk_damage_items_claim_id_claims"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name=op.f("fk_damage_items_created_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_damage_items_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_damage_items")),
    )
    op.create_index(
        "ix_damage_items_claim_id_room_id", "damage_items", ["claim_id", "room_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_damage_items_claim_id_room_id", table_name="damage_items")
    op.drop_table("damage_items")
    op.drop_constraint(op.f("uq_rooms_claim_id_id"), "rooms", type_="unique")
