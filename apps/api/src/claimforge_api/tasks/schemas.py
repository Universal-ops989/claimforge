"""Request and response schemas for claim tasks."""

from datetime import date, datetime
from enum import StrEnum
from typing import Annotated, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from claimforge_api.claims.schemas import Blankable, ClaimActor, ClaimRef

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Description = Annotated[
    Annotated[str, StringConstraints(strip_whitespace=True, max_length=4000)] | None, Blankable
]
_ASSIGNEE = "A member whose role can do field work (`field_data:write`)"


class TaskCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Title = Field(examples=["Set 3 dehumidifiers in the basement"])
    description: Description = None
    due_on: date | None = None
    assignee_id: UUID | None = Field(default=None, description=_ASSIGNEE)


class TaskUpdate(BaseModel):
    """Only the fields sent change; `null` clears the description, due date or assignee."""

    model_config = ConfigDict(extra="forbid")

    title: Title | None = None
    description: Description = None
    due_on: date | None = None
    assignee_id: UUID | None = Field(default=None, description=_ASSIGNEE)
    done: bool | None = Field(
        default=None, description="`true` completes the task, `false` reopens it"
    )

    @model_validator(mode="after")
    def _required_stay(self) -> Self:
        for field in ("title", "done"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be cleared")
        return self


class TaskStatus(StrEnum):
    OPEN = "open"
    DONE = "done"


class TaskListQuery(BaseModel):
    status: TaskStatus | None = Field(default=None, description="Both when omitted")


class AssignedTaskQuery(BaseModel):
    status: TaskStatus = TaskStatus.OPEN
    due_by: date | None = Field(
        default=None, description="Due on or before this day; tasks without a due date drop out"
    )


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    claim: ClaimRef
    title: str
    description: str | None
    due_on: date | None
    assignee: ClaimActor | None
    done: bool
    completed_at: datetime | None
    completed_by_id: UUID | None
    created_by_id: UUID | None
    created_at: datetime
    updated_at: datetime
