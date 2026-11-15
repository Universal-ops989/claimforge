"""Queue photos for their thumbnails and previews; photos already uploaded go first.

Revision ID: 1463402b5b0f
Revises: e7cf1c3ace6c
Create Date: 2026-11-15 22:47:35.286736+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "1463402b5b0f"
down_revision: str | None = "e7cf1c3ace6c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

#: Photos uploaded before the worker existed: queued, oldest first.
BACKFILL = (
    "INSERT INTO photo_processing (photo_id, next_attempt_at) "
    "SELECT id, created_at FROM photos ON CONFLICT (photo_id) DO NOTHING"
)


def upgrade() -> None:
    op.create_table(
        "photo_processing",
        sa.Column("photo_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("attempts", sa.SmallInteger(), server_default="0", nullable=False),
        sa.Column(
            "next_attempt_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("error", sa.String(length=500), nullable=True),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
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
            "(status = 'ready') = (width IS NOT NULL AND height IS NOT NULL)",
            name=op.f("ck_photo_processing_ready_has_dimensions"),
        ),
        sa.CheckConstraint(
            "status IN ('failed', 'pending', 'ready')",
            name=op.f("ck_photo_processing_status_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["photo_id"],
            ["photos.id"],
            name=op.f("fk_photo_processing_photo_id_photos"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("photo_id", name=op.f("pk_photo_processing")),
    )
    op.create_index(
        "ix_photo_processing_queue",
        "photo_processing",
        ["next_attempt_at"],
        unique=False,
        postgresql_where=sa.text("status = 'pending'"),
    )
    op.execute(BACKFILL)


def downgrade() -> None:
    op.drop_index(
        "ix_photo_processing_queue",
        table_name="photo_processing",
        postgresql_where=sa.text("status = 'pending'"),
    )
    op.drop_table("photo_processing")
