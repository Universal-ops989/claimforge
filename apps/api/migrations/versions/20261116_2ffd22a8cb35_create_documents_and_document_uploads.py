"""Create documents, and the pending uploads that become them.

Revision ID: 2ffd22a8cb35
Revises: ee77b985206b
Create Date: 2026-11-16 00:10:23.215285+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "2ffd22a8cb35"
down_revision: str | None = "ee77b985206b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CONTENT_TYPES = (
    "content_type IN ('application/msword', 'application/pdf', "
    "'application/vnd.ms-excel', "
    "'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', "
    "'application/vnd.openxmlformats-officedocument.wordprocessingml.document', "
    "'image/heic', 'image/jpeg', 'image/png', 'image/webp', 'message/rfc822', 'text/csv',"
    " 'text/plain')"
)
CATEGORIES = (
    "category IN ('authorization', 'correspondence', 'estimate', 'invoice', 'other', "
    "'policy', 'report')"
)


def upgrade() -> None:
    op.create_table(
        "document_uploads",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("category", sa.String(length=20), nullable=False),
        sa.Column("created_by_id", sa.Uuid(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("claim_id", sa.Uuid(), nullable=False),
        sa.Column("storage_key", sa.String(length=512), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
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
        sa.CheckConstraint("btrim(title) <> ''", name=op.f("ck_document_uploads_title_not_blank")),
        sa.CheckConstraint(CATEGORIES, name=op.f("ck_document_uploads_category_valid")),
        sa.CheckConstraint(CONTENT_TYPES, name=op.f("ck_document_uploads_content_type_valid")),
        sa.CheckConstraint("size_bytes > 0", name=op.f("ck_document_uploads_size_positive")),
        sa.ForeignKeyConstraint(
            ["claim_id"],
            ["claims.id"],
            name=op.f("fk_document_uploads_claim_id_claims"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name=op.f("fk_document_uploads_created_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_document_uploads_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_document_uploads")),
        sa.UniqueConstraint("storage_key", name=op.f("uq_document_uploads_storage_key")),
    )
    op.create_index("ix_document_uploads_claim_id", "document_uploads", ["claim_id"], unique=False)
    op.create_index(
        "ix_document_uploads_expires_at", "document_uploads", ["expires_at"], unique=False
    )
    op.create_table(
        "documents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("uploaded_by_id", sa.Uuid(), nullable=True),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("category", sa.String(length=20), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("claim_id", sa.Uuid(), nullable=False),
        sa.Column("storage_key", sa.String(length=512), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
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
        sa.CheckConstraint("btrim(title) <> ''", name=op.f("ck_documents_title_not_blank")),
        sa.CheckConstraint(CATEGORIES, name=op.f("ck_documents_category_valid")),
        sa.CheckConstraint(CONTENT_TYPES, name=op.f("ck_documents_content_type_valid")),
        sa.CheckConstraint("size_bytes > 0", name=op.f("ck_documents_size_positive")),
        sa.ForeignKeyConstraint(
            ["claim_id"],
            ["claims.id"],
            name=op.f("fk_documents_claim_id_claims"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_documents_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["uploaded_by_id"],
            ["users.id"],
            name=op.f("fk_documents_uploaded_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_documents")),
        sa.UniqueConstraint("storage_key", name=op.f("uq_documents_storage_key")),
    )
    op.create_index("ix_documents_claim_id_id", "documents", ["claim_id", "id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_documents_claim_id_id", table_name="documents")
    op.drop_table("documents")
    op.drop_index("ix_document_uploads_expires_at", table_name="document_uploads")
    op.drop_index("ix_document_uploads_claim_id", table_name="document_uploads")
    op.drop_table("document_uploads")
