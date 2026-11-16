"""Add atmospheric readings (temperature and humidity) to monitoring visits.

Revision ID: 99767f332cea
Revises: a6056e827148
Create Date: 2026-11-16 02:27:07.452628+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "99767f332cea"
down_revision: str | None = "a6056e827148"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # First: the new table's foreign key to placements needs it.
    op.create_unique_constraint(
        op.f("uq_equipment_placements_claim_id_id"), "equipment_placements", ["claim_id", "id"]
    )
    op.create_table(
        "atmospheric_readings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("claim_id", sa.Uuid(), nullable=False),
        sa.Column("log_id", sa.Uuid(), nullable=False),
        sa.Column("location", sa.String(length=20), nullable=False),
        sa.Column("room_id", sa.Uuid(), nullable=True),
        sa.Column("placement_id", sa.Uuid(), nullable=True),
        sa.Column("temperature_f", sa.Numeric(precision=4, scale=1), nullable=False),
        sa.Column("relative_humidity", sa.Numeric(precision=4, scale=1), nullable=False),
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
            "(location = 'dehumidifier') = (placement_id IS NOT NULL)",
            name=op.f("ck_atmospheric_readings_placement_iff_dehumidifier"),
        ),
        sa.CheckConstraint(
            "(location = 'room') = (room_id IS NOT NULL)",
            name=op.f("ck_atmospheric_readings_room_iff_room"),
        ),
        sa.CheckConstraint(
            "location IN ('dehumidifier', 'outdoors', 'room', 'unaffected')",
            name=op.f("ck_atmospheric_readings_location_valid"),
        ),
        sa.CheckConstraint(
            "relative_humidity BETWEEN 0 AND 100",
            name=op.f("ck_atmospheric_readings_humidity_valid"),
        ),
        sa.CheckConstraint(
            "temperature_f BETWEEN -40 AND 160",
            name=op.f("ck_atmospheric_readings_temperature_plausible"),
        ),
        sa.ForeignKeyConstraint(
            ["claim_id", "log_id"],
            ["moisture_logs.claim_id", "moisture_logs.id"],
            name=op.f("fk_atmospheric_readings_claim_id_moisture_logs"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["claim_id", "placement_id"],
            ["equipment_placements.claim_id", "equipment_placements.id"],
            name=op.f("fk_atmospheric_readings_claim_id_equipment_placements"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["claim_id", "room_id"],
            ["rooms.claim_id", "rooms.id"],
            name=op.f("fk_atmospheric_readings_claim_id_rooms"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["claim_id"],
            ["claims.id"],
            name=op.f("fk_atmospheric_readings_claim_id_claims"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_atmospheric_readings_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_atmospheric_readings")),
    )
    op.create_index(
        "ix_atmospheric_readings_claim_id_room_id",
        "atmospheric_readings",
        ["claim_id", "room_id"],
        unique=False,
    )
    op.create_index(
        "uq_atmospheric_readings_place",
        "atmospheric_readings",
        ["log_id", "location", "room_id", "placement_id"],
        unique=True,
        postgresql_nulls_not_distinct=True,
    )


def downgrade() -> None:
    op.drop_index(
        "uq_atmospheric_readings_place",
        table_name="atmospheric_readings",
        postgresql_nulls_not_distinct=True,
    )
    op.drop_index("ix_atmospheric_readings_claim_id_room_id", table_name="atmospheric_readings")
    op.drop_table("atmospheric_readings")
    op.drop_constraint(
        op.f("uq_equipment_placements_claim_id_id"), "equipment_placements", type_="unique"
    )
