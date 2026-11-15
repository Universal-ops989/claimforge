"""Full-text search: indexed documents on the tables, and prefix queries against them.

Each searchable table has a stored, generated ``search_vector`` column with a GIN index.
Names, addresses and identifiers use the ``simple`` configuration (no stemming, any
language); prose (descriptions, notes) uses ``english`` so "flooded" finds "flood".

Queries match every term as a prefix, so results appear while someone is still typing:
"whitf aust" finds Dana Whitfield in Austin.
"""

import re

from sqlalchemy import ColumnElement, func, literal_column

# ─── Documents (SQL for Computed columns; every function used must be immutable) ───


def simple(expression: str) -> str:
    return f"to_tsvector('simple'::regconfig, coalesce({expression}, ''))"


def english(expression: str) -> str:
    return f"to_tsvector('english'::regconfig, coalesce({expression}, ''))"


def identifier(expression: str) -> str:
    """Claim and policy numbers with their punctuation as spaces: "2026-00042" indexes as
    "2026" and "00042" instead of "2026" and "-00042", so typing either part finds it."""
    return f"translate({expression}, '-/.#_', '     ')"


def weighted(weight: str, *vectors: str) -> str:
    """Weight A ranks highest, D lowest."""
    return " || ".join(f"setweight({vector}, '{weight}')" for vector in vectors)


def document(*parts: str) -> str:
    return " || ".join(parts)


# ─── Queries ───────────────────────────────────────────────────────────────────

_TERM = re.compile(r"\w+")
MAX_TERMS = 8
_SIMPLE: ColumnElement[str] = literal_column("'simple'::regconfig")
_ENGLISH: ColumnElement[str] = literal_column("'english'::regconfig")


def terms(q: str) -> list[str]:
    """The words of a search, lowercased, once each, at most :data:`MAX_TERMS`.

    Only word characters survive, so nothing a user types can reach tsquery syntax.
    """
    return list(dict.fromkeys(t.lower() for t in _TERM.findall(q)))[:MAX_TERMS]


def term_query(term: str) -> ColumnElement[str]:
    """``term`` as a prefix, both as written and stemmed."""
    pattern = f"{term}:*"
    return func.to_tsquery(_SIMPLE, pattern).op("||")(func.to_tsquery(_ENGLISH, pattern))


def matches(vector: ColumnElement[str], term: str) -> ColumnElement[bool]:
    return vector.op("@@")(term_query(term))


def query(q: str) -> ColumnElement[str] | None:
    """Every term of ``q`` ANDed into one tsquery, for ranking; None if ``q`` has no words."""
    words = terms(q)
    if not words:
        return None
    combined = term_query(words[0])
    for word in words[1:]:
        combined = combined.op("&&")(term_query(word))
    return combined
