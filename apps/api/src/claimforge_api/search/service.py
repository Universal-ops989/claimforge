"""One search box for an organization's claims and contacts.

A claim matches when every word of the search appears somewhere on it: its own numbers,
carrier and description, its property's address, the contacts linked to it, or its notes.
"whitfield austin" therefore finds Dana Whitfield's claim in Austin, though no single record
holds both words. Words match as prefixes, so results come while someone is typing.
"""

from uuid import UUID

from sqlalchemy import ColumnElement, SQLColumnExpression, and_, case, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from claimforge_api.auth.permissions import Permission, authorize, has_permission
from claimforge_api.claims.models import Claim, ClaimContact
from claimforge_api.contacts.models import Contact
from claimforge_api.db import fulltext
from claimforge_api.notes.models import Note
from claimforge_api.properties.models import Property
from claimforge_api.search.schemas import ClaimHit, ContactHit, MatchedIn, SearchResults
from claimforge_api.users.models import User

#: How much a match in each place counts towards a claim's rank.
WEIGHTS = {
    MatchedIn.CLAIM: 1.0,
    MatchedIn.PROPERTY: 0.8,
    MatchedIn.CONTACT: 0.8,
    MatchedIn.NOTE: 0.4,
}
#: Typing a claim's number, or the carrier's, puts that claim first.
EXACT_NUMBER_BOOST = 10.0


def _linked_contacts(condition: ColumnElement[bool]) -> ColumnElement[bool]:
    return exists(
        select(1)
        .select_from(ClaimContact)
        .join(Contact, Contact.id == ClaimContact.contact_id)
        .where(ClaimContact.claim_id == Claim.id, Contact.not_deleted(), condition)
    )


def _notes(condition: ColumnElement[bool]) -> ColumnElement[bool]:
    return exists(select(1).where(Note.claim_id == Claim.id, condition))


def _claim_matches(term: str) -> ColumnElement[bool]:
    """``term`` appears anywhere on the claim."""
    return or_(
        fulltext.matches(Claim.search_vector, term),
        fulltext.matches(Property.search_vector, term),
        _linked_contacts(fulltext.matches(Contact.search_vector, term)),
        _notes(fulltext.matches(Note.search_vector, term)),
    )


async def _claims(
    session: AsyncSession,
    organization_id: UUID,
    q: str,
    words: list[str],
    ranking: ColumnElement[str],
    limit: int,
) -> list[ClaimHit]:
    def rank(vector: SQLColumnExpression[str]) -> ColumnElement[float]:
        return func.ts_rank(vector, ranking)

    contact_rank = (
        select(func.max(rank(Contact.search_vector)))
        .select_from(ClaimContact)
        .join(Contact, Contact.id == ClaimContact.contact_id)
        .where(ClaimContact.claim_id == Claim.id, Contact.not_deleted())
        .scalar_subquery()
    )
    note_rank = (
        select(func.max(rank(Note.search_vector))).where(Note.claim_id == Claim.id)
    ).scalar_subquery()
    typed = q.strip().lower()
    exact = case(
        (
            or_(
                func.lower(Claim.number) == typed,
                func.lower(Claim.carrier_claim_number) == typed,
            ),
            EXACT_NUMBER_BOOST,
        ),
        else_=0.0,
    )
    score = (
        exact
        + WEIGHTS[MatchedIn.CLAIM] * rank(Claim.search_vector)
        + WEIGHTS[MatchedIn.PROPERTY] * rank(Property.search_vector)
        + WEIGHTS[MatchedIn.CONTACT] * func.coalesce(contact_rank, 0.0)
        + WEIGHTS[MatchedIn.NOTE] * func.coalesce(note_rank, 0.0)
    ).label("score")
    found_in = {
        MatchedIn.CLAIM: Claim.search_vector.op("@@")(ranking),
        MatchedIn.PROPERTY: Property.search_vector.op("@@")(ranking),
        MatchedIn.CONTACT: _linked_contacts(Contact.search_vector.op("@@")(ranking)),
        MatchedIn.NOTE: _notes(Note.search_vector.op("@@")(ranking)),
    }
    statement = (
        select(Claim, score, *(column.label(place.value) for place, column in found_in.items()))
        .join(Property, Property.id == Claim.property_id)
        .where(
            Claim.organization_id == organization_id,
            Claim.not_deleted(),
            and_(*(_claim_matches(word) for word in words)),
        )
        .options(
            selectinload(Claim.property),
            selectinload(Claim.primary_contact).selectinload(ClaimContact.contact),
            selectinload(Claim.adjuster),
        )
        .order_by(score.desc(), Claim.id.desc())
        .limit(limit)
        .execution_options(populate_existing=True)
    )
    hits = []
    for row in await session.execute(statement):
        places = [place for place in WEIGHTS if getattr(row, place.value)]
        hits.append(ClaimHit.model_validate({"claim": row.Claim, "matched_in": places}))
    return hits


async def _contacts(
    session: AsyncSession,
    organization_id: UUID,
    words: list[str],
    ranking: ColumnElement[str],
    limit: int,
) -> list[ContactHit]:
    rows = await session.scalars(
        select(Contact)
        .where(
            Contact.organization_id == organization_id,
            Contact.not_deleted(),
            *(fulltext.matches(Contact.search_vector, word) for word in words),
        )
        .order_by(func.ts_rank(Contact.search_vector, ranking).desc(), Contact.full_name)
        .limit(limit)
    )
    return [ContactHit.model_validate({"contact": contact}) for contact in rows]


async def search(
    session: AsyncSession, organization_id: UUID, q: str, *, user: User, limit: int
) -> SearchResults:
    """The best ``limit`` claims and contacts for ``q``, each section ranked on its own."""
    membership = await authorize(session, user, organization_id, Permission.ORG_READ)
    words = fulltext.terms(q)
    # Records that hold only some of the words rank against any of them.
    ranking = fulltext.any_query(q)
    if not words or ranking is None:
        return SearchResults(claims=[], contacts=[])
    claims = []
    if has_permission(membership.role, Permission.CLAIMS_READ):
        claims = await _claims(session, organization_id, q, words, ranking, limit)
    contacts = []
    if has_permission(membership.role, Permission.CONTACTS_READ):
        contacts = await _contacts(session, organization_id, words, ranking, limit)
    return SearchResults(claims=claims, contacts=contacts)
