"""Assigning organization members to claims as adjuster, contractor or field technician."""

from uuid import UUID

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.audit.models import AuditEvent
from claimforge_api.claims import service
from claimforge_api.claims.models import AssignmentRole as As
from claimforge_api.claims.models import Claim
from claimforge_api.claims.schemas import (
    ClaimAssignmentCreate,
    ClaimCreate,
    ClaimStatusChangeCreate,
)
from claimforge_api.core.errors import NotFoundError, PermissionDeniedError
from claimforge_api.organizations import service as organizations
from claimforge_api.organizations.schemas import OrganizationCreate
from claimforge_api.users import service as users
from claimforge_api.users.models import Membership, Role, User

ADDRESS = {"line1": "123 Main St", "city": "Austin", "region": "TX", "postal_code": "78701"}


@pytest.fixture
async def claim(db_session: AsyncSession, organization_id: UUID, user: User) -> Claim:
    data = ClaimCreate.model_validate({"loss_type": "water", "property": {"address": ADDRESS}})
    return await service.create_claim(db_session, organization_id, data, user=user)


class Staff:
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


@pytest.fixture
def staff(db_session: AsyncSession, organization_id: UUID) -> Staff:
    return Staff(db_session, organization_id)


async def assign(
    session: AsyncSession, organization_id: UUID, by: User, claim: Claim, who: User, role: As
) -> None:
    await service.assign(
        session,
        organization_id,
        claim.id,
        ClaimAssignmentCreate(user_id=who.id, role=role),
        user=by,
    )


async def crew(
    session: AsyncSession, organization_id: UUID, user: User, claim: Claim
) -> list[tuple[str, str]]:
    fresh = await service.get_claim(session, organization_id, claim.id, user=user)
    return [(a.user.full_name, a.role) for a in fresh.assignments]


async def test_staff_a_claim(
    db_session: AsyncSession, organization_id: UUID, user: User, staff: Staff, claim: Claim
) -> None:
    avery = await staff.hire(Role.ADJUSTER, "Avery Adjuster")
    toni = await staff.hire(Role.TECHNICIAN, "Toni Tech")
    casey = await staff.hire(Role.TECHNICIAN, "Casey Crew")

    await assign(db_session, organization_id, user, claim, avery, As.ADJUSTER)
    await assign(db_session, organization_id, user, claim, toni, As.FIELD_TECHNICIAN)
    await assign(db_session, organization_id, avery, claim, casey, As.CONTRACTOR)

    assert await crew(db_session, organization_id, user, claim) == [
        ("Avery Adjuster", "adjuster"),
        ("Toni Tech", "field_technician"),
        ("Casey Crew", "contractor"),
    ]
    fresh = await service.get_claim(db_session, organization_id, claim.id, user=user)
    assert [a.assigned_by_id for a in fresh.assignments] == [user.id, user.id, avery.id]


async def test_a_new_adjuster_replaces_the_current_one(
    db_session: AsyncSession, organization_id: UUID, user: User, staff: Staff, claim: Claim
) -> None:
    avery = await staff.hire(Role.ADJUSTER, "Avery Adjuster")
    blake = await staff.hire(Role.ADMIN, "Blake Boss")
    await assign(db_session, organization_id, user, claim, avery, As.ADJUSTER)

    await assign(db_session, organization_id, user, claim, blake, As.ADJUSTER)

    assert await crew(db_session, organization_id, user, claim) == [("Blake Boss", "adjuster")]
    removed = await db_session.scalar(
        select(AuditEvent).where(AuditEvent.action == "claim_assignment.deleted")
    )
    assert removed is not None
    assert removed.changes["user_id"] == [str(avery.id), None]


@pytest.mark.parametrize(
    ("member_role", "assignment", "allowed"),
    [
        (Role.VIEWER, As.FIELD_TECHNICIAN, False),
        (Role.VIEWER, As.ADJUSTER, False),
        (Role.TECHNICIAN, As.ADJUSTER, False),
        (Role.TECHNICIAN, As.FIELD_TECHNICIAN, True),
        (Role.TECHNICIAN, As.CONTRACTOR, True),
        (Role.ADJUSTER, As.ADJUSTER, True),
        (Role.OWNER, As.FIELD_TECHNICIAN, True),
    ],
)
async def test_the_member_must_be_able_to_do_the_work(
    db_session: AsyncSession,
    organization_id: UUID,
    user: User,
    staff: Staff,
    claim: Claim,
    member_role: Role,
    assignment: As,
    allowed: bool,
) -> None:
    person = await staff.hire(member_role, "Pat Person")

    if allowed:
        await assign(db_session, organization_id, user, claim, person, assignment)
        assert await crew(db_session, organization_id, user, claim) == [("Pat Person", assignment)]
    else:
        with pytest.raises(service.AssigneeLacksPermissionError) as caught:
            await assign(db_session, organization_id, user, claim, person, assignment)
        assert caught.value.extra["member_role"] == member_role


async def test_only_members_can_be_assigned(
    db_session: AsyncSession, organization_id: UUID, user: User, claim: Claim
) -> None:
    stranger = await users.create_user(db_session, email="x@example.com", full_name="Stranger")
    # A member of another organization is still a stranger here.
    await organizations.create_organization(
        db_session, OrganizationCreate(name="Theirs"), owner=stranger
    )

    with pytest.raises(service.UnknownAssigneeError):
        await assign(db_session, organization_id, user, claim, stranger, As.FIELD_TECHNICIAN)


async def test_one_assignment_per_person(
    db_session: AsyncSession, organization_id: UUID, user: User, staff: Staff, claim: Claim
) -> None:
    avery = await staff.hire(Role.ADJUSTER, "Avery Adjuster")
    await assign(db_session, organization_id, user, claim, avery, As.FIELD_TECHNICIAN)

    with pytest.raises(service.AlreadyAssignedError) as caught:
        await assign(db_session, organization_id, user, claim, avery, As.ADJUSTER)
    assert caught.value.extra["current_role"] == "field_technician"


async def test_unassign(
    db_session: AsyncSession, organization_id: UUID, user: User, staff: Staff, claim: Claim
) -> None:
    toni = await staff.hire(Role.TECHNICIAN, "Toni Tech")
    await assign(db_session, organization_id, user, claim, toni, As.FIELD_TECHNICIAN)

    await service.unassign(db_session, organization_id, claim.id, toni.id, user=user)

    assert await crew(db_session, organization_id, user, claim) == []
    with pytest.raises(NotFoundError, match="not assigned"):
        await service.unassign(db_session, organization_id, claim.id, toni.id, user=user)


async def test_who_may_assign_and_when(
    db_session: AsyncSession, organization_id: UUID, user: User, staff: Staff, claim: Claim
) -> None:
    viewer = await staff.hire(Role.VIEWER, "Vic Viewer")
    toni = await staff.hire(Role.TECHNICIAN, "Toni Tech")

    with pytest.raises(PermissionDeniedError):
        await assign(db_session, organization_id, viewer, claim, toni, As.FIELD_TECHNICIAN)

    await service.change_status(
        db_session,
        organization_id,
        claim.id,
        ClaimStatusChangeCreate.model_validate({"status": "cancelled", "reason": "Duplicate"}),
        user=user,
    )
    with pytest.raises(service.ClaimLockedError):
        await assign(db_session, organization_id, user, claim, toni, As.FIELD_TECHNICIAN)


async def test_leaving_the_organization_ends_the_assignments(
    db_session: AsyncSession, organization_id: UUID, user: User, staff: Staff, claim: Claim
) -> None:
    toni = await staff.hire(Role.TECHNICIAN, "Toni Tech")
    await assign(db_session, organization_id, user, claim, toni, As.FIELD_TECHNICIAN)

    membership = await db_session.scalar(
        select(Membership).where(
            Membership.organization_id == organization_id, Membership.user_id == toni.id
        )
    )
    await db_session.delete(membership)
    await db_session.commit()

    assert await crew(db_session, organization_id, user, claim) == []
