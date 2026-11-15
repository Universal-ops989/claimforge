"""Create photos, and the pending uploads that become them.

Revision ID: e7cf1c3ace6c
Revises: e0ae3c29c954
Create Date: 2026-11-15 21:49:03.393947+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e7cf1c3ace6c"
down_revision: str | None = "e0ae3c29c954"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "photo_uploads",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_by_id", sa.Uuid(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("claim_id", sa.Uuid(), nullable=False),
        sa.Column("storage_key", sa.String(length=512), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=20), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("taken_at", sa.DateTime(timezone=True), nullable=True),
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
            "content_type IN ('image/heic', 'image/heif', 'image/jpeg', 'image/png', 'image/webp')",
            name=op.f("ck_photo_uploads_content_type_valid"),
        ),
        sa.CheckConstraint("size_bytes > 0", name=op.f("ck_photo_uploads_size_positive")),
        sa.ForeignKeyConstraint(
            ["claim_id"],
            ["claims.id"],
            name=op.f("fk_photo_uploads_claim_id_claims"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name=op.f("fk_photo_uploads_created_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_photo_uploads_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_photo_uploads")),
        sa.UniqueConstraint("storage_key", name=op.f("uq_photo_uploads_storage_key")),
    )
    op.create_index("ix_photo_uploads_claim_id", "photo_uploads", ["claim_id"], unique=False)
    op.create_index("ix_photo_uploads_expires_at", "photo_uploads", ["expires_at"], unique=False)
    op.create_table(
        "photos",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("uploaded_by_id", sa.Uuid(), nullable=True),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("claim_id", sa.Uuid(), nullable=False),
        sa.Column("storage_key", sa.String(length=512), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=20), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("taken_at", sa.DateTime(timezone=True), nullable=True),
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
            "content_type IN ('image/heic', 'image/heif', 'image/jpeg', 'image/png', 'image/webp')",
            name=op.f("ck_photos_content_type_valid"),
        ),
        sa.CheckConstraint("size_bytes > 0", name=op.f("ck_photos_size_positive")),
        sa.ForeignKeyConstraint(
            ["claim_id"], ["claims.id"], name=op.f("fk_photos_claim_id_claims"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_photos_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["uploaded_by_id"],
            ["users.id"],
            name=op.f("fk_photos_uploaded_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_photos")),
        sa.UniqueConstraint("storage_key", name=op.f("uq_photos_storage_key")),
    )
    op.create_index("ix_photos_claim_id_id", "photos", ["claim_id", "id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_photos_claim_id_id", table_name="photos")
    op.drop_table("photos")
    op.drop_index("ix_photo_uploads_expires_at", table_name="photo_uploads")
    op.drop_index("ix_photo_uploads_claim_id", table_name="photo_uploads")
    op.drop_table("photo_uploads")
