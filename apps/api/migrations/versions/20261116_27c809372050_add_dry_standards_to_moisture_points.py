"""Add a dry standard, and how it was set, to moisture points.

Revision ID: 27c809372050
Revises: 99767f332cea
Create Date: 2026-11-16 02:55:01.740078+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "27c809372050"
down_revision: str | None = "99767f332cea"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

#: CHECK constraints, by name after "ck_moisture_points_".
CHECKS = {
    "dry_standard_basis_valid": "dry_standard_basis IN ('manual', 'published', 'reference')",
    "dry_standard_has_basis": "(dry_standard IS NULL) = (dry_standard_basis IS NULL)",
    "dry_standard_not_negative": "dry_standard >= 0",
}


def upgrade() -> None:
    op.add_column(
        "moisture_points",
        sa.Column("dry_standard", sa.Numeric(precision=5, scale=1), nullable=True),
    )
    op.add_column(
        "moisture_points", sa.Column("dry_standard_basis", sa.String(length=20), nullable=True)
    )
    for name, condition in CHECKS.items():
        op.create_check_constraint(op.f(f"ck_moisture_points_{name}"), "moisture_points", condition)


def downgrade() -> None:
    for name in CHECKS:
        op.drop_constraint(op.f(f"ck_moisture_points_{name}"), "moisture_points", type_="check")
    op.drop_column("moisture_points", "dry_standard_basis")
    op.drop_column("moisture_points", "dry_standard")
