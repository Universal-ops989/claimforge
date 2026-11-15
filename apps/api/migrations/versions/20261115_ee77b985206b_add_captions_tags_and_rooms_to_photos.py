"""Add captions, tags and a room to photos (and to uploads, which become photos).

Revision ID: ee77b985206b
Revises: 1463402b5b0f
Create Date: 2026-11-15 23:32:12.989151+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "ee77b985206b"
down_revision: str | None = "1463402b5b0f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TAGS_LIMITED = "cardinality(tags) <= 20"


def upgrade() -> None:
    op.add_column("photo_uploads", sa.Column("caption", sa.Text(), nullable=True))
    op.add_column(
        "photo_uploads",
        sa.Column(
            "tags", postgresql.ARRAY(sa.String(length=40)), server_default="{}", nullable=False
        ),
    )
    op.add_column("photo_uploads", sa.Column("room_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        op.f("fk_photo_uploads_claim_id_rooms"),
        "photo_uploads",
        "rooms",
        ["claim_id", "room_id"],
        ["claim_id", "id"],
        ondelete="SET NULL (room_id)",
    )
    op.create_check_constraint(op.f("ck_photo_uploads_tags_limited"), "photo_uploads", TAGS_LIMITED)
    op.add_column("photos", sa.Column("caption", sa.Text(), nullable=True))
    op.add_column(
        "photos",
        sa.Column(
            "tags", postgresql.ARRAY(sa.String(length=40)), server_default="{}", nullable=False
        ),
    )
    op.add_column("photos", sa.Column("room_id", sa.Uuid(), nullable=True))
    op.create_index("ix_photos_claim_id_room_id", "photos", ["claim_id", "room_id"], unique=False)
    op.create_index("ix_photos_tags", "photos", ["tags"], unique=False, postgresql_using="gin")
    op.create_foreign_key(
        op.f("fk_photos_claim_id_rooms"),
        "photos",
        "rooms",
        ["claim_id", "room_id"],
        ["claim_id", "id"],
        ondelete="SET NULL (room_id)",
    )
    op.create_check_constraint(op.f("ck_photos_tags_limited"), "photos", TAGS_LIMITED)


def downgrade() -> None:
    op.drop_constraint(op.f("ck_photos_tags_limited"), "photos", type_="check")
    op.drop_constraint(op.f("fk_photos_claim_id_rooms"), "photos", type_="foreignkey")
    op.drop_index("ix_photos_tags", table_name="photos", postgresql_using="gin")
    op.drop_index("ix_photos_claim_id_room_id", table_name="photos")
    op.drop_column("photos", "room_id")
    op.drop_column("photos", "tags")
    op.drop_column("photos", "caption")
    op.drop_constraint(op.f("ck_photo_uploads_tags_limited"), "photo_uploads", type_="check")
    op.drop_constraint(op.f("fk_photo_uploads_claim_id_rooms"), "photo_uploads", type_="foreignkey")
    op.drop_column("photo_uploads", "room_id")
    op.drop_column("photo_uploads", "tags")
    op.drop_column("photo_uploads", "caption")
