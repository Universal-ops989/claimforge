"""Create claims, claim contacts and claim number counters.

Revision ID: 2b024406ec65
Revises: 25ec13cad9ba
Create Date: 2026-11-13 13:56:06.110680+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "2b024406ec65"
down_revision: str | None = "25ec13cad9ba"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "claim_counters",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("year", sa.SmallInteger(), nullable=False),
        sa.Column("last_number", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_claim_counters_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("organization_id", "year", name=op.f("pk_claim_counters")),
    )
    op.create_table(
        "claims",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("number", sa.String(length=20), nullable=False),
        sa.Column("property_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="new", nullable=False),
        sa.Column("loss_type", sa.String(length=20), nullable=False),
        sa.Column("loss_date", sa.Date(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("carrier_name", sa.String(length=200), nullable=True),
        sa.Column("carrier_claim_number", sa.String(length=64), nullable=True),
        sa.Column("policy_number", sa.String(length=64), nullable=True),
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
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "loss_type IN ('water', 'fire', 'smoke', 'mold', 'wind', 'hail', 'storm', 'flood', "
            "'sewage', 'impact', 'vandalism', 'other')",
            name=op.f("ck_claims_loss_type_valid"),
        ),
        sa.CheckConstraint(
            "status IN ('new', 'inspected', 'in_progress', 'on_hold', 'completed', 'closed', "
            "'cancelled')",
            name=op.f("ck_claims_status_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name=op.f("fk_claims_created_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_claims_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["property_id"],
            ["properties.id"],
            name=op.f("fk_claims_property_id_properties"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_claims")),
        sa.UniqueConstraint(
            "organization_id", "number", name=op.f("uq_claims_organization_id_number")
        ),
    )
    op.create_index(
        "ix_claims_organization_id_live",
        "claims",
        ["organization_id", "id"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(op.f("ix_claims_property_id"), "claims", ["property_id"], unique=False)
    op.create_table(
        "claim_contacts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("claim_id", sa.Uuid(), nullable=False),
        sa.Column("contact_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("is_primary", sa.Boolean(), server_default=sa.text("false"), nullable=False),
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
            "role IN ('insured', 'co_insured', 'tenant', 'property_manager', 'public_adjuster', "
            "'insurance_agent', 'carrier_adjuster', 'other')",
            name=op.f("ck_claim_contacts_role_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["claim_id"],
            ["claims.id"],
            name=op.f("fk_claim_contacts_claim_id_claims"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["contact_id"],
            ["contacts.id"],
            name=op.f("fk_claim_contacts_contact_id_contacts"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_claim_contacts_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_claim_contacts")),
        sa.UniqueConstraint(
            "claim_id", "contact_id", name=op.f("uq_claim_contacts_claim_id_contact_id")
        ),
    )
    op.create_index(
        op.f("ix_claim_contacts_contact_id"), "claim_contacts", ["contact_id"], unique=False
    )
    op.create_index(
        "uq_claim_contacts_primary",
        "claim_contacts",
        ["claim_id"],
        unique=True,
        postgresql_where=sa.text("is_primary"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_claim_contacts_primary",
        table_name="claim_contacts",
        postgresql_where=sa.text("is_primary"),
    )
    op.drop_index(op.f("ix_claim_contacts_contact_id"), table_name="claim_contacts")
    op.drop_table("claim_contacts")
    op.drop_index(op.f("ix_claims_property_id"), table_name="claims")
    op.drop_index(
        "ix_claims_organization_id_live",
        table_name="claims",
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.drop_table("claims")
    op.drop_table("claim_counters")
