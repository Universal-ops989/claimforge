"""Create moisture points: the spots read on every drying visit.

Revision ID: 3f4738107b93
Revises: 2ffd22a8cb35
Create Date: 2026-11-16 00:39:35.930098+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "3f4738107b93"
down_revision: str | None = "2ffd22a8cb35"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "moisture_points",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("claim_id", sa.Uuid(), nullable=False),
        sa.Column("room_id", sa.Uuid(), nullable=False),
        sa.Column("label", sa.String(length=20), nullable=False),
        sa.Column("material", sa.String(length=100), nullable=False),
        sa.Column("surface", sa.String(length=20), nullable=False),
        sa.Column("scale", sa.String(length=20), nullable=False),
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
        sa.CheckConstraint("btrim(label) <> ''", name=op.f("ck_moisture_points_label_not_blank")),
        sa.CheckConstraint(
            "scale IN ('percent', 'reference')", name=op.f("ck_moisture_points_scale_valid")
        ),
        sa.CheckConstraint(
            "surface IN ('cabinetry', 'ceiling', 'contents', 'fixture', 'floor', 'other', "
            "'trim', 'wall')",
            name=op.f("ck_moisture_points_surface_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["claim_id", "room_id"],
            ["rooms.claim_id", "rooms.id"],
            name=op.f("fk_moisture_points_claim_id_rooms"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["claim_id"],
            ["claims.id"],
            name=op.f("fk_moisture_points_claim_id_claims"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_moisture_points_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_moisture_points")),
        sa.UniqueConstraint("claim_id", "id", name=op.f("uq_moisture_points_claim_id_id")),
    )
    op.create_index(
        "ix_moisture_points_claim_id_room_id",
        "moisture_points",
        ["claim_id", "room_id"],
        unique=False,
    )
    op.create_index(
        "uq_moisture_points_claim_id_label",
        "moisture_points",
        ["claim_id", sa.literal_column("lower(label)")],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_moisture_points_claim_id_label", table_name="moisture_points")
    op.drop_index("ix_moisture_points_claim_id_room_id", table_name="moisture_points")
    op.drop_table("moisture_points")
