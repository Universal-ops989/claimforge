"""Create notes and note_mentions: the written record on a claim, and who it mentions.

Revision ID: 1dc5a6d3dbec
Revises: 3ac51feac439
Create Date: 2026-11-15 17:08:13.814024+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "1dc5a6d3dbec"
down_revision: str | None = "3ac51feac439"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "notes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("claim_id", sa.Uuid(), nullable=False),
        sa.Column("author_id", sa.Uuid(), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["author_id"], ["users.id"], name=op.f("fk_notes_author_id_users"), ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["claim_id"], ["claims.id"], name=op.f("fk_notes_claim_id_claims"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_notes_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_notes")),
    )
    op.create_index("ix_notes_claim_id_id", "notes", ["claim_id", "id"], unique=False)
    op.create_table(
        "note_mentions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("note_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["note_id"],
            ["notes.id"],
            name=op.f("fk_note_mentions_note_id_notes"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_note_mentions_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_note_mentions_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_note_mentions")),
        sa.UniqueConstraint("note_id", "user_id", name=op.f("uq_note_mentions_note_id_user_id")),
    )
    op.create_index(
        "ix_note_mentions_organization_id_user_id",
        "note_mentions",
        ["organization_id", "user_id", "note_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_note_mentions_organization_id_user_id", table_name="note_mentions")
    op.drop_table("note_mentions")
    op.drop_index("ix_notes_claim_id_id", table_name="notes")
    op.drop_table("notes")
