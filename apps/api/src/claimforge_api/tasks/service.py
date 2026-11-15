"""The to-do list on each claim, and the tasks assigned to you across claims.

Reading needs ``claims:read``. Writing needs ``field_data:write`` and a claim that is not
closed or cancelled. Tasks are shared work: anyone who can write may edit, reassign or
complete one. The creator or an admin (``claims:delete``) deletes one.
"""

from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from claimforge_api.auth.permissions import Permission, authorize, has_permission
from claimforge_api.claims import service as claims
from claimforge_api.claims.models import Claim
from claimforge_api.core.errors import NotFoundError, PermissionDeniedError
from claimforge_api.db.pagination import Page, SortKey, paginate
from claimforge_api.tasks.models import Task
from claimforge_api.tasks.schemas import (
    AssignedTaskQuery,
    TaskCreate,
    TaskListQuery,
    TaskStatus,
    TaskUpdate,
)
from claimforge_api.users.models import User

#: Soonest due first; tasks without a due date last (NULL sorts as largest).
SOONEST_DUE = SortKey([Task.due_on, Task.id])


class NotTheCreatorError(PermissionDeniedError):
    code = "not_task_creator"
    title = "Not your task"


def _tasks(organization_id: UUID) -> Select[Task]:
    """Tasks with everything a task response shows, loaded up front."""
    return (
        select(Task)
        .where(Task.organization_id == organization_id)
        .options(selectinload(Task.claim), selectinload(Task.assignee))
        # Objects created earlier in this session have their relationships unloaded.
        .execution_options(populate_existing=True)
    )


def _with_status(statement: Select[Task], status: TaskStatus | None) -> Select[Task]:
    if status == TaskStatus.OPEN:
        return statement.where(Task.completed_at.is_(None))
    if status == TaskStatus.DONE:
        return statement.where(Task.completed_at.is_not(None))
    return statement


async def _get_task(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, task_id: UUID
) -> Task:
    task = await session.scalar(
        _tasks(organization_id).where(Task.id == task_id, Task.claim_id == claim_id)
    )
    if task is None:
        raise NotFoundError("Task not found", task_id=str(task_id))
    return task


async def _check_assignee(session: AsyncSession, organization_id: UUID, user_id: UUID) -> None:
    await claims.check_assignee(
        session, organization_id, user_id, Permission.FIELD_DATA_WRITE, "assigned tasks"
    )


async def list_tasks(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    query: TaskListQuery,
    *,
    user: User,
) -> list[Task]:
    """A claim's tasks: open ones first, each group soonest due first."""
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    await claims.require_live(session, organization_id, claim_id)
    statement = _with_status(_tasks(organization_id).where(Task.claim_id == claim_id), query.status)
    statement = statement.order_by(Task.completed_at.is_not(None), Task.due_on, Task.id)
    return list(await session.scalars(statement))


async def tasks_assigned_to_me(
    session: AsyncSession,
    organization_id: UUID,
    query: AssignedTaskQuery,
    *,
    user: User,
    limit: int,
    cursor: str | None,
) -> Page[Task]:
    """Tasks on live claims assigned to ``user``, soonest due first."""
    await authorize(session, user, organization_id, Permission.CLAIMS_READ)
    statement = _with_status(
        _tasks(organization_id)
        .join(Claim, Claim.id == Task.claim_id)
        .where(Task.assignee_id == user.id, Claim.not_deleted()),
        query.status,
    )
    if query.due_by is not None:
        statement = statement.where(Task.due_on <= query.due_by)
    return await paginate(session, statement, SOONEST_DUE, limit=limit, cursor=cursor)


async def create_task(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, data: TaskCreate, *, user: User
) -> Task:
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    if data.assignee_id is not None:
        await _check_assignee(session, organization_id, data.assignee_id)
    task = Task(
        organization_id=organization_id,
        claim_id=claim_id,
        created_by_id=user.id,
        **data.model_dump(),
    )
    session.add(task)
    await session.commit()
    return await _get_task(session, organization_id, claim_id, task.id)


async def update_task(
    session: AsyncSession,
    organization_id: UUID,
    claim_id: UUID,
    task_id: UUID,
    data: TaskUpdate,
    *,
    user: User,
) -> Task:
    """Edit, reassign, complete (``done: true``) or reopen (``done: false``) a task."""
    await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    task = await _get_task(session, organization_id, claim_id, task_id)
    changes = data.model_dump(exclude_unset=True)

    done = changes.pop("done", None)
    assignee_id = changes.get("assignee_id")
    if assignee_id is not None and assignee_id != task.assignee_id:
        await _check_assignee(session, organization_id, assignee_id)
    for field, value in changes.items():
        setattr(task, field, value)
    # Completing a done task or reopening an open one changes nothing.
    if done is True and not task.done:
        task.completed_at, task.completed_by_id = func.now(), user.id
    elif done is False and task.done:
        task.completed_at, task.completed_by_id = None, None
    # Unchanged values leave no history, so a no-op writes neither a row nor an audit event.
    await session.commit()
    return await _get_task(session, organization_id, claim_id, task_id)


async def delete_task(
    session: AsyncSession, organization_id: UUID, claim_id: UUID, task_id: UUID, *, user: User
) -> None:
    membership = await authorize(session, user, organization_id, Permission.FIELD_DATA_WRITE)
    await claims.lock_for_changes(session, organization_id, claim_id)
    task = await _get_task(session, organization_id, claim_id, task_id)
    if task.created_by_id != user.id and not has_permission(
        membership.role, Permission.CLAIMS_DELETE
    ):
        raise NotTheCreatorError(
            "Only the creator or an admin can delete a task",
            task_id=str(task_id),
            required_permission=Permission.CLAIMS_DELETE.value,
        )
    await session.delete(task)
    await session.commit()
