"""Tag audit events with their claim, and record past status changes as events.

Revision ID: 14f26ad51f61
Revises: a173f23b4c4e
Create Date: 2026-11-15 19:06:28.024621+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "14f26ad51f61"
down_revision: str | None = "a173f23b4c4e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Run in order; tests replay them against real data (tests/audit/test_claim_events.py).
BACKFILL = (
    # A claim's own events.
    "UPDATE audit_events SET claim_id = entity_id WHERE entity_type = 'claim'",
    # Records under a claim never change claims, and their created (or deleted) event
    # holds claim_id, so every event of the same record takes it from there.
    """
    UPDATE audit_events AS e SET claim_id = known.claim_id
    FROM (
        SELECT DISTINCT ON (entity_type, entity_id)
            entity_type,
            entity_id,
            COALESCE(changes -> 'claim_id' ->> 1, changes -> 'claim_id' ->> 0)::uuid AS claim_id
        FROM audit_events
        WHERE changes ? 'claim_id'
        ORDER BY entity_type, entity_id, id
    ) AS known
    WHERE e.claim_id IS NULL
        AND e.entity_type = known.entity_type
        AND e.entity_id = known.entity_id
    """,
    # Status changes weren't audited before; record each one as the recorder would have.
    # Their own UUIDv7 ids keep them in time order among the other events.
    """
    INSERT INTO audit_events (
        id, organization_id, actor_user_id, action, entity_type, entity_id, claim_id,
        changes, created_at
    )
    SELECT
        s.id,
        s.organization_id,
        s.changed_by_id,
        'claim_status_change.created',
        'claim_status_change',
        s.id,
        s.claim_id,
        jsonb_strip_nulls(jsonb_build_object(
            'organization_id', jsonb_build_array(NULL, s.organization_id),
            'claim_id', jsonb_build_array(NULL, s.claim_id),
            'from_status', jsonb_build_array(NULL, s.from_status),
            'to_status', jsonb_build_array(NULL, s.to_status),
            'reason', CASE WHEN s.reason IS NOT NULL THEN jsonb_build_array(NULL, s.reason) END,
            'changed_by_id',
                CASE WHEN s.changed_by_id IS NOT NULL
                THEN jsonb_build_array(NULL, s.changed_by_id) END
        )),
        s.changed_at
    FROM claim_status_changes AS s
    WHERE NOT EXISTS (SELECT 1 FROM audit_events AS a WHERE a.id = s.id)
    """,
)


def upgrade() -> None:
    op.add_column("audit_events", sa.Column("claim_id", sa.Uuid(), nullable=True))
    for statement in BACKFILL:
        op.execute(statement)
    op.create_index(
        "ix_audit_events_claim_timeline",
        "audit_events",
        ["claim_id", "id"],
        unique=False,
        postgresql_where=sa.text("claim_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_audit_events_claim_timeline",
        table_name="audit_events",
        postgresql_where=sa.text("claim_id IS NOT NULL"),
    )
    # Upgrading again rebuilds them from claim_status_changes.
    op.execute("DELETE FROM audit_events WHERE entity_type = 'claim_status_change'")
    op.drop_column("audit_events", "claim_id")
