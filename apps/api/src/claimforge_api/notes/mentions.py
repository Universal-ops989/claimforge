"""Mention tokens in note bodies.

A mention is ``<@user-id>`` in the body, as a mention picker inserts it. Storing the id
rather than the name keeps a mention pointing at the right person when names change or
two members share one; readers get the names filled in by :func:`render`.
"""

import re
from collections.abc import Mapping
from uuid import UUID

_HEX = "[0-9a-fA-F]"
TOKEN = re.compile(rf"<@({_HEX}{{8}}-{_HEX}{{4}}-{_HEX}{{4}}-{_HEX}{{4}}-{_HEX}{{12}})>")

#: Shown for a mention whose member can no longer be resolved.
UNKNOWN = "unknown member"


def token(user_id: UUID) -> str:
    return f"<@{user_id}>"


def mentioned_ids(body: str) -> list[UUID]:
    """Everyone mentioned in ``body``, once each, in order of first mention."""
    return list(dict.fromkeys(UUID(match) for match in TOKEN.findall(body)))


def render(body: str, names: Mapping[UUID, str]) -> str:
    """``body`` with each mention token replaced by ``@Full Name``."""
    return TOKEN.sub(lambda m: f"@{names.get(UUID(m[1]), UNKNOWN)}", body)
