"""Add a logo to report templates.

Revision ID: 12c1f7c83d53
Revises: 11bbc16c886b
Create Date: 2026-11-16 05:12:18.269913+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "12c1f7c83d53"
down_revision: str | None = "11bbc16c886b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("report_templates", sa.Column("logo_key", sa.String(length=512), nullable=True))


def downgrade() -> None:
    op.drop_column("report_templates", "logo_key")
