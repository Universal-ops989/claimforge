"""Changing a member's role, and removing a member (or leaving), over HTTP."""

from uuid import UUID

import httpx2
from fastapi import FastAPI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.claims import service as claims
from claimforge_api.claims.models import AssignmentRole, ClaimAssignment
from claimforge_api.claims.schemas import ClaimAssignmentCreate, ClaimCreate
from claimforge_api.core.settings import Settings
from claimforge_api.core.tokens import create_access_token
from claimforge_api.tasks import service as tasks
from claimforge_api.tasks.models import Task
from claimforge_api.tasks.schemas import TaskCreate
from claimforge_api.users import service as users
from claimforge_api.users.models import Membership, Role, User

ADDRESS = {"line1": "123 Main St", "city": "Austin", "region": "TX", "postal_code": "78701"}


def member_url(organization_id: UUID, user_id: UUID) -> str:
    return f"/v1/organizations/{organization_id}/members/{user_id}"


async def hire(session: AsyncSession, organization_id: UUID, role: Role, name: str) -> User:
    person = await users.create_user(
        session, email=f"{name.split()[0].lower()}@example.com", full_name=name
    )
    session.add(Membership(organization_id=organization_id, user_id=person.id, role=role))
    await session.commit()
    return person


def client_as(app: FastAPI, settings: Settings, person: User) -> httpx2.AsyncClient:
    return httpx2.AsyncClient(
        transport=httpx2.ASGITransport(app=app),
        base_url="http://testserver",
        headers={"Authorization": f"Bearer {create_access_token(person.id, settings).token}"},
    )


async def role_of(session: AsyncSession, organization_id: UUID, person: User) -> str | None:
    """The member's role as stored now (None once they're gone), not as the session saw it."""
    user_id = person.id  # read before expiring: an expired attribute can't load here
    session.expire_all()
    return await session.scalar(
        select(Membership.role).where(
            Membership.organization_id == organization_id, Membership.user_id == user_id
        )
    )


# ─── Changing a role ─────────────────────────────────────────────────────────


async def test_an_owner_changes_a_role_and_gets_the_member_back(
    auth_client: httpx2.AsyncClient, db_session: AsyncSession, organization_id: UUID
) -> None:
    riley = await hire(db_session, organization_id, Role.TECHNICIAN, "Riley Tech")

    response = await auth_client.patch(
        member_url(organization_id, riley.id), json={"role": "adjuster"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["user"] == {"id": str(riley.id), "full_name": "Riley Tech"}
    assert body["role"] == "adjuster"
    assert "claims:write" in body["permissions"]
    assert await role_of(db_session, organization_id, riley) == "adjuster"


async def test_an_admin_cant_make_an_owner_nor_touch_one(
    app: FastAPI,
    settings: Settings,
    db_session: AsyncSession,
    organization_id: UUID,
    user: User,
) -> None:
    admin = await hire(db_session, organization_id, Role.ADMIN, "Avery Admin")
    riley = await hire(db_session, organization_id, Role.TECHNICIAN, "Riley Tech")

    async with client_as(app, settings, admin) as client:
        promote = await client.patch(member_url(organization_id, riley.id), json={"role": "owner"})
        demote = await client.patch(member_url(organization_id, user.id), json={"role": "viewer"})
        remove = await client.delete(member_url(organization_id, user.id))
        allowed = await client.patch(member_url(organization_id, riley.id), json={"role": "viewer"})

    assert [promote.status_code, demote.status_code, remove.status_code] == [403, 403, 403]
    assert allowed.status_code == 200
    assert await role_of(db_session, organization_id, user) == "owner"


async def test_the_last_owner_stays_an_owner_until_there_is_another(
    auth_client: httpx2.AsyncClient, db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    alone = await auth_client.patch(member_url(organization_id, user.id), json={"role": "admin"})
    partner = await hire(db_session, organization_id, Role.ADMIN, "Pat Partner")
    await auth_client.patch(member_url(organization_id, partner.id), json={"role": "owner"})
    stepped_down = await auth_client.patch(
        member_url(organization_id, user.id), json={"role": "admin"}
    )

    assert alone.status_code == 409
    assert alone.json()["code"] == "last_owner"
    assert stepped_down.status_code == 200


async def test_a_role_that_cant_do_the_members_work_is_refused(
    auth_client: httpx2.AsyncClient, db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    avery = await hire(db_session, organization_id, Role.ADJUSTER, "Avery Adjuster")
    claim = await claims.create_claim(
        db_session,
        organization_id,
        ClaimCreate.model_validate({"loss_type": "water", "property": {"address": ADDRESS}}),
        user=user,
    )
    await claims.assign(
        db_session,
        organization_id,
        claim.id,
        ClaimAssignmentCreate(user_id=avery.id, role=AssignmentRole.ADJUSTER),
        user=user,
    )
    await tasks.create_task(
        db_session,
        organization_id,
        claim.id,
        TaskCreate(title="Call the carrier", assignee_id=avery.id),
        user=user,
    )

    # A technician can still do field work (the task), not adjust (the assignment).
    technician = await auth_client.patch(
        member_url(organization_id, avery.id), json={"role": "technician"}
    )
    viewer = await auth_client.patch(member_url(organization_id, avery.id), json={"role": "viewer"})

    assert technician.status_code == 409
    assert technician.json()["code"] == "member_has_work"
    assert (technician.json()["assignments"], technician.json()["open_tasks"]) == (1, 0)
    assert (viewer.json()["assignments"], viewer.json()["open_tasks"]) == (1, 1)
    assert await role_of(db_session, organization_id, avery) == "adjuster"


async def test_changing_needs_members_manage_and_a_member(
    app: FastAPI,
    settings: Settings,
    auth_client: httpx2.AsyncClient,
    db_session: AsyncSession,
    organization_id: UUID,
    user: User,
) -> None:
    riley = await hire(db_session, organization_id, Role.TECHNICIAN, "Riley Tech")
    stranger = await users.create_user(
        db_session, email="stranger@example.com", full_name="Not Here"
    )

    async with client_as(app, settings, riley) as client:
        self_promotion = await client.patch(
            member_url(organization_id, riley.id), json={"role": "owner"}
        )
    unknown = await auth_client.patch(
        member_url(organization_id, stranger.id), json={"role": "viewer"}
    )

    assert self_promotion.status_code == 403
    assert unknown.status_code == 404


# ─── Removing, and leaving ──────────────────────────────────────────────────


async def test_removing_ends_assignments_and_leaves_tasks_unassigned(
    auth_client: httpx2.AsyncClient, db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    riley = await hire(db_session, organization_id, Role.TECHNICIAN, "Riley Tech")
    claim = await claims.create_claim(
        db_session,
        organization_id,
        ClaimCreate.model_validate({"loss_type": "water", "property": {"address": ADDRESS}}),
        user=user,
    )
    await claims.assign(
        db_session,
        organization_id,
        claim.id,
        ClaimAssignmentCreate(user_id=riley.id, role=AssignmentRole.FIELD_TECHNICIAN),
        user=user,
    )
    task = await tasks.create_task(
        db_session,
        organization_id,
        claim.id,
        TaskCreate(title="Set dehumidifiers", assignee_id=riley.id),
        user=user,
    )

    riley_id, task_id = riley.id, task.id

    response = await auth_client.delete(member_url(organization_id, riley_id))

    assert response.status_code == 204
    assert await role_of(db_session, organization_id, riley) is None
    assignments = await db_session.scalars(
        select(ClaimAssignment).where(ClaimAssignment.user_id == riley_id)
    )
    assert list(assignments) == []
    kept = await db_session.get(Task, task_id)
    assert kept is not None
    assert kept.assignee_id is None


async def test_anyone_can_leave_but_the_last_owner(
    app: FastAPI,
    settings: Settings,
    auth_client: httpx2.AsyncClient,
    db_session: AsyncSession,
    organization_id: UUID,
    user: User,
) -> None:
    viewer = await hire(db_session, organization_id, Role.VIEWER, "Val Viewer")
    other = await hire(db_session, organization_id, Role.TECHNICIAN, "Riley Tech")

    async with client_as(app, settings, viewer) as client:
        remove_other = await client.delete(member_url(organization_id, other.id))
        leave = await client.delete(member_url(organization_id, viewer.id))
    last_owner = await auth_client.delete(member_url(organization_id, user.id))

    assert remove_other.status_code == 403
    assert leave.status_code == 204
    assert await role_of(db_session, organization_id, viewer) is None
    assert last_owner.status_code == 409
    assert last_owner.json()["code"] == "last_owner"
