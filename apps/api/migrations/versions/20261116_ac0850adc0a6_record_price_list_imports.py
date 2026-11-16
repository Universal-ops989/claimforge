"""Record when a price list last imported items.

Revision ID: ac0850adc0a6
Revises: e50fa3e4cc09
Create Date: 2026-11-16 03:37:23.866625+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "ac0850adc0a6"
down_revision: str | None = "e50fa3e4cc09"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "price_lists", sa.Column("imported_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("price_lists", "imported_at")
