"""Add sales tax, overhead and profit rates to estimates, and taxable lines.

Revision ID: c9a9f72c93ee
Revises: f8fc0532d0c7
Create Date: 2026-11-16 04:21:18.217695+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c9a9f72c93ee"
down_revision: str | None = "f8fc0532d0c7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

#: CHECK constraints on estimates, by name after "ck_estimates_".
CHECKS = {
    "tax_percent_valid": "tax_percent BETWEEN 0 AND 100",
    "overhead_percent_valid": "overhead_percent BETWEEN 0 AND 100",
    "profit_percent_valid": "profit_percent BETWEEN 0 AND 100",
}


def upgrade() -> None:
    op.add_column(
        "estimate_lines",
        sa.Column("taxable", sa.Boolean(), server_default=sa.text("true"), nullable=False),
    )
    op.add_column(
        "estimates",
        sa.Column(
            "tax_percent",
            sa.Numeric(precision=6, scale=3),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )
    op.add_column(
        "estimates",
        sa.Column(
            "overhead_percent",
            sa.Numeric(precision=6, scale=3),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )
    op.add_column(
        "estimates",
        sa.Column(
            "profit_percent",
            sa.Numeric(precision=6, scale=3),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )
    for name, condition in CHECKS.items():
        op.create_check_constraint(op.f(f"ck_estimates_{name}"), "estimates", condition)


def downgrade() -> None:
    for name in CHECKS:
        op.drop_constraint(op.f(f"ck_estimates_{name}"), "estimates", type_="check")
    op.drop_column("estimates", "profit_percent")
    op.drop_column("estimates", "overhead_percent")
    op.drop_column("estimates", "tax_percent")
    op.drop_column("estimate_lines", "taxable")
