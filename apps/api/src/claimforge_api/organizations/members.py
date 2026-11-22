"""Changing who is in an organization, and as what.

Two rules hold throughout. Nobody hands out more than they hold, or touches someone who
holds more (an admin can't promote anyone to owner, nor demote or remove an owner). And an
organization always keeps an owner: the last one can't be demoted, removed, or leave.
"""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.auth.permissions import Permission, authorize, permissions_for
from claimforge_api.claims.models import Claim, ClaimAssignment
from claimforge_api.claims.service import ASSIGNMENT_NEEDS
from claimforge_api.core.errors import ConflictError, NotFoundError, PermissionDeniedError
from claimforge_api.tasks.models import Task
from claimforge_api.users.models import Membership, Role, User


class LastOwnerError(ConflictError):
    code = "last_owner"
    title = "An organization needs an owner"


class MemberHasWorkError(ConflictError):
    code = "member_has_work"
    title = "The new role can't do this member's work"


async def _membership(session: AsyncSession, organization_id: UUID, user_id: UUID) -> Membership:
    found = await session.scalar(
        select(Membership)
        .join(User, User.id == Membership.user_id)
        .where(
            Membership.organization_id == organization_id,
            Membership.user_id == user_id,
            User.not_deleted(),
        )
    )
    if found is None:
        raise NotFoundError("Member not found", user_id=str(user_id))
    return found


def _outranks(role: Role | str, other: Role | str) -> bool:
    """Whether ``other`` holds anything ``role`` doesn't."""
    return not permissions_for(other) <= permissions_for(role)


async def _owners(session: AsyncSession, organization_id: UUID) -> int:
    count = await session.scalar(
        select(func.count())
        .select_from(Membership)
        .join(User, User.id == Membership.user_id)
        .where(
            Membership.organization_id == organization_id,
            Membership.role == Role.OWNER,
            User.not_deleted(),
        )
    )
    return count or 0


async def _keeps_an_owner(session: AsyncSession, membership: Membership) -> None:
    if membership.role == Role.OWNER and await _owners(session, membership.organization_id) <= 1:
        raise LastOwnerError(
            "This is the organization's only owner: make someone else an owner first"
        )


async def _work_beyond(session: AsyncSession, membership: Membership, role: Role) -> None:
    """Refuse ``role`` if it can't do the claim assignments or open tasks the member has."""
    allowed = permissions_for(role)
    beyond = [kind for kind, needs in ASSIGNMENT_NEEDS.items() if needs not in allowed]
    assignments = 0
    if beyond:
        assignments = (
            await session.scalar(
                select(func.count())
                .select_from(ClaimAssignment)
                .join(Claim, Claim.id == ClaimAssignment.claim_id)
                .where(
                    ClaimAssignment.organization_id == membership.organization_id,
                    ClaimAssignment.user_id == membership.user_id,
                    ClaimAssignment.role.in_(beyond),
                    Claim.not_deleted(),
                )
            )
            or 0
        )
    open_tasks = 0
    if Permission.FIELD_DATA_WRITE not in allowed:
        open_tasks = (
            await session.scalar(
                select(func.count())
                .select_from(Task)
                .join(Claim, Claim.id == Task.claim_id)
                .where(
                    Task.organization_id == membership.organization_id,
                    Task.assignee_id == membership.user_id,
                    Task.completed_at.is_(None),
                    Claim.not_deleted(),
                )
            )
            or 0
        )
    if assignments or open_tasks:
        raise MemberHasWorkError(
            f"A {role} can't do this member's work: unassign them first",
            role=role.value,
            assignments=assignments,
            open_tasks=open_tasks,
        )


async def change_role(
    session: AsyncSession, *, user: User, organization_id: UUID, member_id: UUID, role: Role
) -> Membership:
    """Give a member another role; see the module's rules."""
    mine = await authorize(session, user, organization_id, Permission.MEMBERS_MANAGE)
    membership = await _membership(session, organization_id, member_id)
    if membership.role == role:
        return membership
    if _outranks(mine.role, membership.role) or _outranks(mine.role, role):
        raise PermissionDeniedError(
            f"A {mine.role} can't change a {membership.role} into a {role}",
            member_role=str(membership.role),
            requested_role=role.value,
        )
    if role != Role.OWNER:
        await _keeps_an_owner(session, membership)
    await _work_beyond(session, membership, role)
    membership.role = role
    await session.commit()
    await session.refresh(membership, ["user"])
    return membership


async def remove(
    session: AsyncSession, *, user: User, organization_id: UUID, member_id: UUID
) -> None:
    """Take a member out, or leave. Their claim assignments end with the membership; their
    tasks stay on the claims, unassigned (both by the schema's foreign keys)."""
    leaving = member_id == user.id
    mine = await authorize(
        session,
        user,
        organization_id,
        Permission.ORG_READ if leaving else Permission.MEMBERS_MANAGE,
    )
    membership = await _membership(session, organization_id, member_id)
    if not leaving and _outranks(mine.role, membership.role):
        raise PermissionDeniedError(
            f"A {mine.role} can't remove a {membership.role}",
            member_role=str(membership.role),
        )
    await _keeps_an_owner(session, membership)
    await session.delete(membership)
    await session.commit()
