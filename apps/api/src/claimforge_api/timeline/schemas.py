"""Response schemas for the claim timeline."""

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from claimforge_api.claims.schemas import ClaimActor


class TimelineKind(StrEnum):
    """What an entry is about; the timeline's tabs and filters."""

    CLAIM = "claim"
    STATUS = "status"
    CONTACTS = "contacts"
    TEAM = "team"
    LAYOUT = "layout"
    DAMAGE = "damage"
    NOTES = "notes"
    TASKS = "tasks"
    OTHER = "other"


#: Audit entity types behind each kind.
ENTITY_TYPES: dict[TimelineKind, tuple[str, ...]] = {
    TimelineKind.CLAIM: ("claim",),
    TimelineKind.STATUS: ("claim_status_change",),
    TimelineKind.CONTACTS: ("claim_contact",),
    TimelineKind.TEAM: ("claim_assignment",),
    TimelineKind.LAYOUT: ("structure", "room"),
    TimelineKind.DAMAGE: ("damage_item",),
    TimelineKind.NOTES: ("note",),
    TimelineKind.TASKS: ("task",),
}
KIND_OF = {entity: kind for kind, entities in ENTITY_TYPES.items() for entity in entities}


class TimelineQuery(BaseModel):
    kind: list[TimelineKind] = Field(
        default_factory=list, description="Only these kinds; repeat for several. All when omitted."
    )


class TimelineSubject(BaseModel):
    type: str = Field(examples=["note"])
    id: UUID


class TimelineEntry(BaseModel):
    id: UUID
    at: datetime
    kind: TimelineKind
    action: str = Field(examples=["note.created"])
    actor: ClaimActor | None = Field(description="Null for system changes or deleted accounts")
    subject: TimelineSubject
    summary: str = Field(examples=["Changed the status from new to on hold: Waiting on PA"])
    changes: dict[str, list[Any]] = Field(description="`{field: [before, after]}`")
