"""Create properties (loss locations).

Revision ID: 25ec13cad9ba
Revises: b05d16bc7390
Create Date: 2026-11-13 13:01:34.904533+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "25ec13cad9ba"
down_revision: str | None = "b05d16bc7390"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "properties",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("address_line1", sa.String(length=200), nullable=False),
        sa.Column("address_line2", sa.String(length=100), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=False),
        sa.Column("region", sa.String(length=100), nullable=True),
        sa.Column("postal_code", sa.String(length=16), nullable=True),
        sa.Column("country", sa.String(length=2), nullable=False),
        sa.Column("address_key", sa.String(length=500), nullable=False),
        sa.Column("property_type", sa.String(length=20), nullable=False),
        sa.Column("year_built", sa.SmallInteger(), nullable=True),
        sa.Column("latitude", sa.Numeric(precision=9, scale=6, asdecimal=False), nullable=True),
        sa.Column("longitude", sa.Numeric(precision=9, scale=6, asdecimal=False), nullable=True),
        sa.Column("access_notes", sa.Text(), nullable=True),
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
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("country ~ '^[A-Z]{2}$'", name=op.f("ck_properties_country_format")),
        sa.CheckConstraint(
            "property_type IN ('residential', 'multi_family', 'commercial', 'industrial', 'other')",
            name=op.f("ck_properties_property_type_valid"),
        ),
        sa.CheckConstraint(
            "(latitude IS NULL) = (longitude IS NULL)"
            " AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180",
            name=op.f("ck_properties_coordinates_valid"),
        ),
        sa.CheckConstraint(
            "year_built BETWEEN 1600 AND 2100", name=op.f("ck_properties_year_built_range")
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_properties_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_properties")),
    )
    op.create_index(
        "ix_properties_organization_id_live",
        "properties",
        ["organization_id", "id"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "uq_properties_address_live",
        "properties",
        ["organization_id", "address_key"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_properties_address_live",
        table_name="properties",
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.drop_index(
        "ix_properties_organization_id_live",
        table_name="properties",
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.drop_table("properties")
