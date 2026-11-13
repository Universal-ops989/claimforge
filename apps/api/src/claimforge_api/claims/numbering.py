"""Claim numbers: "2026-00042", sequential per organization and calendar year.

One counter row per (organization, year) is bumped with a single atomic upsert. The row
stays locked until the surrounding transaction ends, so concurrent creates in the same
organization queue up instead of colliding. Because the bump is part of the claim's own
transaction, a rolled-back create also rolls back its number: numbers have no gaps.
"""

from uuid import UUID

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.claims.models import ClaimCounter

DIGITS = 5


def format_claim_number(year: int, sequence: int) -> str:
    """Zero-padded to five digits; a sixth appears only past 99,999 claims in a year."""
    return f"{year}-{sequence:0{DIGITS}d}"


async def next_claim_number(session: AsyncSession, organization_id: UUID, year: int) -> str:
    statement = (
        insert(ClaimCounter)
        .values(organization_id=organization_id, year=year, last_number=1)
        .on_conflict_do_update(
            index_elements=[ClaimCounter.organization_id, ClaimCounter.year],
            set_={"last_number": ClaimCounter.last_number + 1},
        )
        .returning(ClaimCounter.last_number)
    )
    sequence = (await session.execute(statement)).scalar_one()
    return format_claim_number(year, sequence)
