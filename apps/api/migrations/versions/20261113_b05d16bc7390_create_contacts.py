"""Create contacts (policyholders and other claim contacts).

Revision ID: b05d16bc7390
Revises: 346f029446fc
Create Date: 2026-11-13 12:29:10.925844+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b05d16bc7390"
down_revision: str | None = "346f029446fc"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "contacts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("full_name", sa.String(length=200), nullable=False),
        sa.Column("company_name", sa.String(length=200), nullable=True),
        sa.Column("email", sa.String(length=254), nullable=True),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("preferred_contact_method", sa.String(length=16), nullable=True),
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
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "kind IN ('policyholder', 'tenant', 'property_manager', 'public_adjuster', "
            "'insurance_agent', 'carrier_adjuster', 'contractor', 'other')",
            name=op.f("ck_contacts_kind_valid"),
        ),
        sa.CheckConstraint(
            "preferred_contact_method IN ('email', 'phone', 'text')",
            name=op.f("ck_contacts_preferred_method_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_contacts_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_contacts")),
    )
    op.create_index(
        "ix_contacts_organization_id_full_name_live",
        "contacts",
        ["organization_id", "full_name", "id"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_contacts_organization_id_full_name_live",
        table_name="contacts",
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.drop_table("contacts")
