"""Create structures and rooms: the buildings and rooms documented for a claim.

Revision ID: b8fe6edb7dfa
Revises: fd7838d5d9e6
Create Date: 2026-11-13 21:25:51.552218+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b8fe6edb7dfa"
down_revision: str | None = "fd7838d5d9e6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "structures",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("claim_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
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
            name=op.f("fk_structures_claim_id_claims"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_structures_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_structures")),
        sa.UniqueConstraint("claim_id", "id", name=op.f("uq_structures_claim_id_id")),
    )
    op.create_index(
        "uq_structures_claim_id_name",
        "structures",
        ["claim_id", sa.literal_column("lower(name)")],
        unique=True,
    )
    op.create_table(
        "rooms",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("claim_id", sa.Uuid(), nullable=False),
        sa.Column("structure_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("level", sa.String(length=40), nullable=True),
        sa.Column("length_ft", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("width_ft", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("height_ft", sa.Numeric(precision=6, scale=2), nullable=True),
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
        sa.CheckConstraint("height_ft > 0", name=op.f("ck_rooms_height_positive")),
        sa.CheckConstraint("length_ft > 0", name=op.f("ck_rooms_length_positive")),
        sa.CheckConstraint("width_ft > 0", name=op.f("ck_rooms_width_positive")),
        sa.ForeignKeyConstraint(
            ["claim_id", "structure_id"],
            ["structures.claim_id", "structures.id"],
            name=op.f("fk_rooms_claim_id_structures"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["claim_id"], ["claims.id"], name=op.f("fk_rooms_claim_id_claims"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_rooms_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_rooms")),
    )
    op.create_index(
        "ix_rooms_claim_id_structure_id", "rooms", ["claim_id", "structure_id"], unique=False
    )
    op.create_index(
        "uq_rooms_structure_id_name",
        "rooms",
        ["structure_id", sa.literal_column("lower(name)")],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_rooms_structure_id_name", table_name="rooms")
    op.drop_index("ix_rooms_claim_id_structure_id", table_name="rooms")
    op.drop_table("rooms")
    op.drop_index("uq_structures_claim_id_name", table_name="structures")
    op.drop_table("structures")
