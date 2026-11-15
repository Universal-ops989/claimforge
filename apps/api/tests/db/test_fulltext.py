"""Full-text search vectors: what each table's document lets people find."""

from typing import Any
from uuid import UUID

import pytest
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.audit.models import AuditEvent
from claimforge_api.claims import service as claims
from claimforge_api.claims.models import Claim
from claimforge_api.claims.schemas import ClaimCreate
from claimforge_api.contacts import service as contacts
from claimforge_api.contacts.models import Contact
from claimforge_api.contacts.schemas import ContactCreate
from claimforge_api.db import fulltext
from claimforge_api.notes import service as notes
from claimforge_api.notes.models import Note
from claimforge_api.notes.schemas import NoteCreate
from claimforge_api.properties.models import Property
from claimforge_api.users.models import User


def test_terms() -> None:
    assert fulltext.terms("  Whitf  AUST whitf ") == ["whitf", "aust"]
    assert fulltext.terms("2026-00042") == ["2026", "00042"]
    # Nothing a user types reaches tsquery syntax.
    assert fulltext.terms("a & b | !c:* <-> 'd'") == ["a", "b", "c", "d"]
    assert fulltext.terms("& | ! ()") == []
    assert len(fulltext.terms(" ".join(f"w{i}" for i in range(20)))) == fulltext.MAX_TERMS
    assert fulltext.query("?!") is None


async def found(session: AsyncSession, model: Any, row_id: UUID, q: str) -> bool:
    vector = model.search_vector
    hit = await session.scalar(
        select(func.count())
        .select_from(model)
        .where(model.id == row_id, and_(*[fulltext.matches(vector, t) for t in fulltext.terms(q)]))
    )
    return bool(hit)


@pytest.fixture
async def claim(db_session: AsyncSession, organization_id: UUID, user: User) -> Claim:
    data = ClaimCreate.model_validate(
        {
            "loss_type": "water",
            "carrier_name": "Lone Star Mutual",
            "carrier_claim_number": "LSM-88213",
            "policy_number": "HO3/4471.22",
            "description": "Supply line flooded the kitchen",
            "property": {
                "address": {
                    "line1": "123 Bluebonnet Lane",
                    "city": "Austin",
                    "region": "TX",
                    "postal_code": "78701",
                }
            },
        }
    )
    return await claims.create_claim(db_session, organization_id, data, user=user)


@pytest.mark.parametrize(
    ("q", "hit"),
    [
        ("88213", True),
        ("lsm 882", True),
        ("4471", True),
        ("lone star", True),
        ("mutu", True),
        ("flood", True),  # stemmed: "flooded"
        ("flooding kitchen", True),
        ("garage", False),
    ],
)
async def test_claims(db_session: AsyncSession, claim: Claim, q: str, hit: bool) -> None:
    assert await found(db_session, Claim, claim.id, q) is hit


async def test_claim_numbers_by_either_part(db_session: AsyncSession, claim: Claim) -> None:
    year, sequence = claim.number.split("-")  # "2026-00001"

    assert await found(db_session, Claim, claim.id, sequence)
    assert await found(db_session, Claim, claim.id, claim.number)
    assert await found(db_session, Claim, claim.id, f"{year}-{sequence[:3]}")


@pytest.mark.parametrize(
    ("q", "hit"),
    [
        ("blueb", True),
        ("austin 787", True),
        ("bluebonnet dallas", False),
    ],
)
async def test_properties(db_session: AsyncSession, claim: Claim, q: str, hit: bool) -> None:
    assert await found(db_session, Property, claim.property_id, q) is hit


@pytest.mark.parametrize(
    ("q", "hit"),
    [
        ("whitf", True),
        ("dana whitfield", True),
        ("dana.w@example.com", True),  # the whole address, typed in full
        ("example", True),
        ("512555", True),  # national number, no +1
        ("15125550142", True),
        ("acme", True),
        ("prefers mornings", True),
        ("smith", False),
    ],
)
async def test_contacts(
    db_session: AsyncSession, organization_id: UUID, user: User, q: str, hit: bool
) -> None:
    dana = await contacts.create_contact(
        db_session,
        organization_id,
        ContactCreate(
            full_name="Dana Whitfield",
            company_name="Acme Property Group",
            email="dana.w@example.com",
            phone="(512) 555-0142",
            notes="Prefers mornings",
        ),
        user=user,
    )

    assert await found(db_session, Contact, dana.id, q) is hit


async def test_notes_index_words_not_mention_tokens(
    db_session: AsyncSession, organization_id: UUID, user: User, claim: Claim
) -> None:
    note = await notes.create_note(
        db_session,
        organization_id,
        claim.id,
        NoteCreate(body=f"<@{user.id}> moisture readings attached"),
        user=user,
    )

    assert await found(db_session, Note, note.id, "reading")
    assert not await found(db_session, Note, note.id, str(user.id).split("-")[0])


async def test_vectors_stay_out_of_the_audit_log(db_session: AsyncSession, claim: Claim) -> None:
    created = await db_session.scalar(
        select(AuditEvent).where(
            AuditEvent.entity_id == claim.id, AuditEvent.action == "claim.created"
        )
    )
    assert created is not None
    assert "search_vector" not in created.changes
