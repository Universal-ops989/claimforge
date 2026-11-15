"""Request and response schemas for claim notes."""

from datetime import datetime
from typing import Annotated, Self
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    computed_field,
    model_validator,
)

from claimforge_api.claims.schemas import ClaimActor, ClaimRef
from claimforge_api.notes import mentions

MAX_MENTIONS = 20

Body = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=10_000),
    Field(
        description="Plain text. Mention a member with `<@user-id>`; each must belong to the "
        f"organization, at most {MAX_MENTIONS} per note.",
        examples=[
            "Moisture mapped in the kitchen. <@0192f3a4-5b6c-7d8e-9f01-23456789abcd> "
            "please review before the carrier call."
        ],
    ),
]


class _NoteWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    body: Body

    @model_validator(mode="after")
    def _not_too_many_mentions(self) -> Self:
        if len(mentions.mentioned_ids(self.body)) > MAX_MENTIONS:
            raise ValueError(f"A note can mention at most {MAX_MENTIONS} members")
        return self


class NoteCreate(_NoteWrite):
    pass


class NoteUpdate(_NoteWrite):
    """Only the author can edit a note. Mentions are re-read from the new body."""


class NoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    claim: ClaimRef
    author: ClaimActor | None = Field(description="Null once the author's account is gone")
    body: str = Field(description="As written, with `<@user-id>` mention tokens")
    mentions: list[ClaimActor] = Field(validation_alias="mentioned_users")
    edited_at: datetime | None
    created_at: datetime
    updated_at: datetime

    # mypy doesn't model a decorator stacked on @property; Pydantic documents this form.
    @computed_field(description="The body with mentions shown as `@Full Name`")  # type: ignore[prop-decorator]
    @property
    def text(self) -> str:
        return mentions.render(self.body, {m.id: m.full_name for m in self.mentions})
