"""Tasks on claims: due dates, assignees, completing, and the tasks assigned to you."""

from datetime import date
from typing import Any
from uuid import UUID

import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.audit.models import AuditEvent
from claimforge_api.claims import service as claims
from claimforge_api.claims.models import Claim
from claimforge_api.claims.schemas import ClaimCreate, ClaimStatusChangeCreate
from claimforge_api.core.errors import NotFoundError, PermissionDeniedError
from claimforge_api.tasks import service
from claimforge_api.tasks.models import Task
from claimforge_api.tasks.schemas import (
    AssignedTaskQuery,
    TaskCreate,
    TaskListQuery,
    TaskRead,
    TaskUpdate,
)
from claimforge_api.users import service as users
from claimforge_api.users.models import Membership, Role, User

ADDRESS = {"line1": "123 Main St", "city": "Austin", "region": "TX", "postal_code": "78701"}
MON, TUE, WED = date(2026, 11, 16), date(2026, 11, 17), date(2026, 11, 18)


async def new_claim(session: AsyncSession, organization_id: UUID, user: User) -> Claim:
    data = ClaimCreate.model_validate({"loss_type": "water", "property": {"address": ADDRESS}})
    return await claims.create_claim(session, organization_id, data, user=user)


@pytest.fixture
async def claim(db_session: AsyncSession, organization_id: UUID, user: User) -> Claim:
    return await new_claim(db_session, organization_id, user)


class Crew:
    def __init__(self, session: AsyncSession, organization_id: UUID) -> None:
        self.session, self.organization_id = session, organization_id

    async def hire(self, role: Role, name: str) -> User:
        email = f"{name.split()[0].lower()}@example.com"
        person = await users.create_user(self.session, email=email, full_name=name)
        self.session.add(
            Membership(organization_id=self.organization_id, user_id=person.id, role=role)
        )
        await self.session.commit()
        return person

    async def add(self, by: User, claim: Claim, title: str, **fields: Any) -> Task:
        return await service.create_task(
            self.session,
            self.organization_id,
            claim.id,
            TaskCreate.model_validate({"title": title, **fields}),
            user=by,
        )

    async def update(self, by: User, task: Task, **fields: Any) -> Task:
        return await service.update_task(
            self.session,
            self.organization_id,
            task.claim_id,
            task.id,
            TaskUpdate.model_validate(fields),
            user=by,
        )

    async def delete(self, by: User, task: Task) -> None:
        await service.delete_task(
            self.session, self.organization_id, task.claim_id, task.id, user=by
        )

    async def board(self, by: User, claim: Claim, **query: Any) -> list[str]:
        tasks = await service.list_tasks(
            self.session,
            self.organization_id,
            claim.id,
            TaskListQuery.model_validate(query),
            user=by,
        )
        return [t.title for t in tasks]

    async def mine(self, me: User, limit: int = 50, **query: Any) -> list[str]:
        page = await service.tasks_assigned_to_me(
            self.session,
            self.organization_id,
            AssignedTaskQuery.model_validate(query),
            user=me,
            limit=limit,
            cursor=None,
        )
        return [t.title for t in page.items]


@pytest.fixture
def crew(db_session: AsyncSession, organization_id: UUID) -> Crew:
    return Crew(db_session, organization_id)


async def audit_actions(session: AsyncSession) -> list[str]:
    rows = await session.scalars(
        select(AuditEvent.action).where(AuditEvent.entity_type == "task").order_by(AuditEvent.id)
    )
    return list(rows)


async def test_add_a_task(crew: Crew, user: User, claim: Claim) -> None:
    toni = await crew.hire(Role.TECHNICIAN, "Toni Tech")

    task = await crew.add(
        user, claim, " Set 3 dehus in the basement ", due_on=TUE, assignee_id=toni.id
    )

    read = TaskRead.model_validate(task)
    assert (read.title, read.due_on, read.done) == ("Set 3 dehus in the basement", TUE, False)
    assert read.assignee is not None
    assert read.assignee.full_name == "Toni Tech"
    assert (read.claim.number, read.created_by_id) == (claim.number, user.id)


async def test_assignees_must_be_able_to_do_field_work(
    db_session: AsyncSession, crew: Crew, user: User, claim: Claim
) -> None:
    viewer = await crew.hire(Role.VIEWER, "Vic Viewer")
    toni = await crew.hire(Role.TECHNICIAN, "Toni Tech")
    stranger = await users.create_user(db_session, email="s@example.com", full_name="Stranger")

    with pytest.raises(claims.AssigneeLacksPermissionError, match="viewer can't be assigned"):
        await crew.add(user, claim, "Read the meters", assignee_id=viewer.id)
    with pytest.raises(claims.UnknownAssigneeError):
        await crew.add(user, claim, "Read the meters", assignee_id=stranger.id)

    task = await crew.add(user, claim, "Read the meters", assignee_id=toni.id)
    with pytest.raises(claims.AssigneeLacksPermissionError):
        await crew.update(user, task, assignee_id=viewer.id)
    task = await crew.update(user, task, assignee_id=None)
    assert task.assignee is None


async def test_complete_and_reopen(
    db_session: AsyncSession, crew: Crew, user: User, claim: Claim
) -> None:
    toni = await crew.hire(Role.TECHNICIAN, "Toni Tech")
    task = await crew.add(user, claim, "Pull the carpet pad")

    task = await crew.update(toni, task, done=True)
    assert (task.done, task.completed_by_id) == (True, toni.id)
    assert task.completed_at is not None

    # Completing it again is not another completion.
    before = await audit_actions(db_session)
    task = await crew.update(user, task, done=True)
    assert task.completed_by_id == toni.id
    assert await audit_actions(db_session) == before

    task = await crew.update(user, task, done=False)
    assert (task.done, task.completed_at, task.completed_by_id) == (False, None, None)


async def test_edit_changes_only_what_is_sent(crew: Crew, user: User, claim: Claim) -> None:
    task = await crew.add(user, claim, "Call carrier", description="Ask about mold", due_on=MON)

    task = await crew.update(user, task, due_on=WED, description="")

    assert (task.title, task.description, task.due_on) == ("Call carrier", None, WED)


def test_input_rules() -> None:
    for body in [{"title": ""}, {"title": " "}, {"title": "x" * 201}, {"title": "x", "done": True}]:
        with pytest.raises(ValidationError):
            TaskCreate.model_validate(body)
    for field in ("title", "done"):
        with pytest.raises(ValidationError, match=f"{field} cannot be cleared"):
            TaskUpdate.model_validate({field: None})


async def test_the_board_shows_open_tasks_first_soonest_due_first(
    crew: Crew, user: User, claim: Claim
) -> None:
    await crew.add(user, claim, "Someday")
    await crew.add(user, claim, "Wednesday", due_on=WED)
    done = await crew.add(user, claim, "Monday, done", due_on=MON)
    await crew.add(user, claim, "Tuesday", due_on=TUE)
    await crew.update(user, done, done=True)

    assert await crew.board(user, claim) == ["Tuesday", "Wednesday", "Someday", "Monday, done"]
    assert await crew.board(user, claim, status="done") == ["Monday, done"]
    assert await crew.board(user, claim, status="open") == ["Tuesday", "Wednesday", "Someday"]


async def test_tasks_assigned_to_me(
    db_session: AsyncSession, organization_id: UUID, crew: Crew, user: User, claim: Claim
) -> None:
    toni = await crew.hire(Role.TECHNICIAN, "Toni Tech")
    other = await new_claim(db_session, organization_id, user)
    gone = await new_claim(db_session, organization_id, user)

    await crew.add(user, claim, "Whenever", assignee_id=toni.id)
    await crew.add(user, other, "Wednesday", assignee_id=toni.id, due_on=WED)
    await crew.add(user, claim, "Monday", assignee_id=toni.id, due_on=MON)
    await crew.add(user, claim, "Not Toni's", due_on=MON)
    finished = await crew.add(user, other, "Finished", assignee_id=toni.id, due_on=TUE)
    await crew.update(toni, finished, done=True)
    await crew.add(user, gone, "On a deleted claim", assignee_id=toni.id, due_on=MON)
    gone.soft_delete()
    await db_session.commit()

    assert await crew.mine(toni) == ["Monday", "Wednesday", "Whenever"]
    assert await crew.mine(toni, due_by=TUE) == ["Monday"]
    assert await crew.mine(toni, status="done") == ["Finished"]
    assert await crew.mine(user) == []


async def test_assigned_to_me_pages_past_tasks_without_a_due_date(
    crew: Crew, user: User, claim: Claim
) -> None:
    for title, due in [("b", None), ("a", MON), ("c", None), ("d", TUE)]:
        await crew.add(user, claim, title, assignee_id=user.id, due_on=due)

    seen: list[str] = []
    cursor = None
    while True:
        page = await service.tasks_assigned_to_me(
            crew.session,
            crew.organization_id,
            AssignedTaskQuery(),
            user=user,
            limit=1,
            cursor=cursor,
        )
        seen += [t.title for t in page.items]
        if not page.has_more:
            break
        cursor = page.next_cursor

    assert seen == ["a", "d", "b", "c"]


async def test_leaving_the_organization_unassigns_but_keeps_the_tasks(
    db_session: AsyncSession, organization_id: UUID, crew: Crew, user: User, claim: Claim
) -> None:
    toni = await crew.hire(Role.TECHNICIAN, "Toni Tech")
    task = await crew.add(user, claim, "Move air movers", assignee_id=toni.id)

    membership = await db_session.scalar(
        select(Membership).where(
            Membership.organization_id == organization_id, Membership.user_id == toni.id
        )
    )
    await db_session.delete(membership)
    await db_session.commit()

    [kept] = await service.list_tasks(
        db_session, organization_id, claim.id, TaskListQuery(), user=user
    )
    assert (kept.id, kept.title, kept.assignee_id) == (task.id, "Move air movers", None)


async def test_who_may_delete(crew: Crew, user: User, claim: Claim) -> None:
    toni = await crew.hire(Role.TECHNICIAN, "Toni Tech")
    casey = await crew.hire(Role.TECHNICIAN, "Casey Crew")
    blake = await crew.hire(Role.ADMIN, "Blake Boss")
    first = await crew.add(toni, claim, "First")
    second = await crew.add(toni, claim, "Second")

    with pytest.raises(service.NotTheCreatorError) as caught:
        await crew.delete(casey, first)
    assert caught.value.extra["required_permission"] == "claims:delete"
    # Anyone who can write may still edit someone else's task.
    await crew.update(casey, first, title="First, edited")

    await crew.delete(toni, first)
    await crew.delete(blake, second)
    assert await crew.board(user, claim) == []
    with pytest.raises(NotFoundError, match="Task not found"):
        await crew.delete(toni, first)


async def test_viewers_read_and_closed_claims_are_read_only(
    db_session: AsyncSession, organization_id: UUID, crew: Crew, user: User, claim: Claim
) -> None:
    viewer = await crew.hire(Role.VIEWER, "Vic Viewer")
    task = await crew.add(user, claim, "Before closing")

    assert await crew.board(viewer, claim) == ["Before closing"]
    with pytest.raises(PermissionDeniedError):
        await crew.update(viewer, task, done=True)

    await claims.change_status(
        db_session,
        organization_id,
        claim.id,
        ClaimStatusChangeCreate.model_validate({"status": "cancelled", "reason": "Duplicate"}),
        user=user,
    )
    with pytest.raises(claims.ClaimLockedError):
        await crew.add(user, claim, "After closing")
    with pytest.raises(claims.ClaimLockedError):
        await crew.update(user, task, done=True)


async def test_the_database_only_takes_members_as_assignees(
    db_session: AsyncSession, organization_id: UUID, claim: Claim
) -> None:
    stranger = await users.create_user(db_session, email="s@example.com", full_name="Stranger")
    db_session.add(
        Task(
            organization_id=organization_id,
            claim_id=claim.id,
            title="Sneak in",
            assignee_id=stranger.id,
        )
    )
    with pytest.raises(IntegrityError, match="fk_tasks_organization_id_memberships"):
        await db_session.flush()
