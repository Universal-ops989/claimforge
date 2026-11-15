"""Response schemas for global search."""

from enum import StrEnum

from pydantic import BaseModel, Field

from claimforge_api.claims.schemas import ClaimSummary
from claimforge_api.contacts.schemas import ContactRead


class MatchedIn(StrEnum):
    """Where on a claim the search words were found."""

    CLAIM = "claim"  # numbers, carrier, description
    PROPERTY = "property"
    CONTACT = "contact"
    NOTE = "note"


class ClaimHit(BaseModel):
    claim: ClaimSummary
    matched_in: list[MatchedIn] = Field(
        description="Where any of the words were found: on the claim itself, its property, "
        "a linked contact or a note"
    )


class ContactHit(BaseModel):
    contact: ContactRead


class SearchResults(BaseModel):
    claims: list[ClaimHit] = Field(description="Empty without `claims:read`")
    contacts: list[ContactHit] = Field(description="Empty without `contacts:read`")
