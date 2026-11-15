"""Add full-text search vectors and GIN indexes to claims, contacts, properties and notes.

Revision ID: e0ae3c29c954
Revises: 14f26ad51f61
Create Date: 2026-11-15 19:43:33.736773+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "e0ae3c29c954"
down_revision: str | None = "14f26ad51f61"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Snapshots of each model's SEARCH_DOCUMENT (see claimforge_api.db.fulltext) at this
# revision. A generated column can't be altered in place: to change one, drop and re-add
# the column in a new migration.
CLAIMS = (
    r"setweight(to_tsvector('simple'::regconfig, coalesce(translate(number, '-/.#_', '"
    r"     '), '')), 'A') || setweight(to_tsvector('simple'::regconfig, "
    r"coalesce(translate(carrier_claim_number, '-/.#_', '     '), '')), 'A') || "
    r"setweight(to_tsvector('simple'::regconfig, coalesce(translate(policy_number, "
    r"'-/.#_', '     '), '')), 'A') || setweight(to_tsvector('simple'::regconfig, "
    r"coalesce(carrier_name, '')), 'B') || setweight(to_tsvector('english'::regconfig, "
    r"coalesce(description, '')), 'D')"
)

CONTACTS = (
    r"setweight(to_tsvector('simple'::regconfig, coalesce(full_name, '')), 'A') || "
    r"setweight(to_tsvector('simple'::regconfig, coalesce(company_name, '')), 'B') || "
    r"setweight(to_tsvector('simple'::regconfig, coalesce(email, '')), 'B') || "
    r"setweight(to_tsvector('simple'::regconfig, coalesce(translate(email, '.@+_-', '     "
    r"'), '')), 'B') || setweight(to_tsvector('simple'::regconfig, "
    r"coalesce(translate(phone, '+', ''), '')), 'B') || "
    r"setweight(to_tsvector('simple'::regconfig, coalesce(regexp_replace(phone, '^\+1', "
    r"''), '')), 'B') || setweight(to_tsvector('english'::regconfig, coalesce(notes, '')),"
    r" 'D')"
)

PROPERTIES = (
    r"setweight(to_tsvector('simple'::regconfig, coalesce(address_line1, '')), 'A') || "
    r"setweight(to_tsvector('simple'::regconfig, coalesce(city, '')), 'A') || "
    r"setweight(to_tsvector('simple'::regconfig, coalesce(postal_code, '')), 'A') || "
    r"setweight(to_tsvector('simple'::regconfig, coalesce(address_line2, '')), 'B') || "
    r"setweight(to_tsvector('simple'::regconfig, coalesce(region, '')), 'B') || "
    r"setweight(to_tsvector('english'::regconfig, coalesce(access_notes, '')), 'D')"
)

NOTES = (
    r"setweight(to_tsvector('english'::regconfig, coalesce(regexp_replace(body, "
    r"'<@[0-9a-fA-F-]{36}>', ' ', 'g'), '')), 'C')"
)

TABLES = {
    "claims": CLAIMS,
    "contacts": CONTACTS,
    "properties": PROPERTIES,
    "notes": NOTES,
}


def upgrade() -> None:
    for table, document in TABLES.items():
        op.add_column(
            table,
            sa.Column(
                "search_vector", postgresql.TSVECTOR(), sa.Computed(document, persisted=True)
            ),
        )
        op.create_index(
            f"ix_{table}_search", table, ["search_vector"], unique=False, postgresql_using="gin"
        )


def downgrade() -> None:
    for table in reversed(TABLES):
        op.drop_index(f"ix_{table}_search", table_name=table, postgresql_using="gin")
        op.drop_column(table, "search_vector")
