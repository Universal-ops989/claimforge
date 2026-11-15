"""HTTP endpoints for claim tasks and the tasks assigned to you."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, status

from claimforge_api.api.deps import DbSession, PageParamsDep
from claimforge_api.api.problems import PROBLEM_RESPONSES
from claimforge_api.auth.deps import CurrentUser
from claimforge_api.db.pagination import CursorPage
from claimforge_api.tasks import service
from claimforge_api.tasks.schemas import (
    AssignedTaskQuery,
    TaskCreate,
    TaskListQuery,
    TaskRead,
    TaskUpdate,
)

router = APIRouter(
    prefix="/organizations/{organization_id}",
    tags=["tasks"],
    responses=PROBLEM_RESPONSES,
)

_WRITE = "Needs `field_data:write`. Closed and cancelled claims are read-only (`claim_locked`)."


@router.get(
    "/claims/{claim_id}/tasks",
    summary="List a claim's tasks",
    description="Open tasks first, then done ones; each group soonest due first, with tasks "
    "that have no due date last.",
)
async def list_tasks(
    organization_id: UUID,
    claim_id: UUID,
    session: DbSession,
    user: CurrentUser,
    query: Annotated[TaskListQuery, Query()],
) -> list[TaskRead]:
    tasks = await service.list_tasks(session, organization_id, claim_id, query, user=user)
    return [TaskRead.model_validate(t) for t in tasks]


@router.post(
    "/claims/{claim_id}/tasks",
    status_code=status.HTTP_201_CREATED,
    summary="Add a task",
    description=f"{_WRITE} The assignee must be a member who can do field work.",
)
async def create_task(
    organization_id: UUID,
    claim_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: TaskCreate,
) -> TaskRead:
    task = await service.create_task(session, organization_id, claim_id, body, user=user)
    return TaskRead.model_validate(task)


@router.patch(
    "/claims/{claim_id}/tasks/{task_id}",
    summary="Update, reassign, complete or reopen a task",
    description=f"{_WRITE} Anyone who can write may change any task on the claim.",
)
async def update_task(
    organization_id: UUID,
    claim_id: UUID,
    task_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: TaskUpdate,
) -> TaskRead:
    task = await service.update_task(session, organization_id, claim_id, task_id, body, user=user)
    return TaskRead.model_validate(task)


@router.delete(
    "/claims/{claim_id}/tasks/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a task",
    description="The creator or an admin (`claims:delete`) can delete a task.",
)
async def delete_task(
    organization_id: UUID, claim_id: UUID, task_id: UUID, session: DbSession, user: CurrentUser
) -> None:
    await service.delete_task(session, organization_id, claim_id, task_id, user=user)


@router.get(
    "/tasks/assigned-to-me",
    summary="Tasks assigned to me",
    description="Tasks on the organization's claims assigned to the signed-in member, "
    "soonest due first. Open tasks unless `status` says otherwise.",
)
async def tasks_assigned_to_me(
    organization_id: UUID,
    session: DbSession,
    user: CurrentUser,
    page: PageParamsDep,
    query: Annotated[AssignedTaskQuery, Query()],
) -> CursorPage[TaskRead]:
    result = await service.tasks_assigned_to_me(
        session, organization_id, query, user=user, limit=page.limit, cursor=page.cursor
    )
    return CursorPage[TaskRead](
        items=[TaskRead.model_validate(t) for t in result.items],
        next_cursor=result.next_cursor,
        has_more=result.has_more,
    )
