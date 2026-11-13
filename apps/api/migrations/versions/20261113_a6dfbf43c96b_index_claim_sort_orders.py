"""Index live claims by loss date and by last update, for the claim list sorts.

Revision ID: a6dfbf43c96b
Revises: 2b024406ec65
Create Date: 2026-11-13 15:36:20.541966+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a6dfbf43c96b"
down_revision: str | None = "2b024406ec65"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_claims_organization_id_loss_date_live",
        "claims",
        ["organization_id", "loss_date", "id"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "ix_claims_organization_id_updated_at_live",
        "claims",
        ["organization_id", "updated_at", "id"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_claims_organization_id_updated_at_live",
        table_name="claims",
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.drop_index(
        "ix_claims_organization_id_loss_date_live",
        table_name="claims",
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
