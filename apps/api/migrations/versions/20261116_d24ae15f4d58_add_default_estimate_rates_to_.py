"""Add the rates new estimates start with to organizations.

Revision ID: d24ae15f4d58
Revises: c9a9f72c93ee
Create Date: 2026-11-16 04:35:10.156154+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d24ae15f4d58"
down_revision: str | None = "c9a9f72c93ee"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

RATES = ("tax", "overhead", "profit")


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column(
            "default_tax_percent",
            sa.Numeric(precision=6, scale=3),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )
    op.add_column(
        "organizations",
        sa.Column(
            "default_overhead_percent",
            sa.Numeric(precision=6, scale=3),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )
    op.add_column(
        "organizations",
        sa.Column(
            "default_profit_percent",
            sa.Numeric(precision=6, scale=3),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )
    for rate in RATES:
        op.create_check_constraint(
            op.f(f"ck_organizations_default_{rate}_valid"),
            "organizations",
            f"default_{rate}_percent BETWEEN 0 AND 100",
        )


def downgrade() -> None:
    for rate in RATES:
        op.drop_constraint(
            op.f(f"ck_organizations_default_{rate}_valid"), "organizations", type_="check"
        )
    op.drop_column("organizations", "default_profit_percent")
    op.drop_column("organizations", "default_overhead_percent")
    op.drop_column("organizations", "default_tax_percent")
