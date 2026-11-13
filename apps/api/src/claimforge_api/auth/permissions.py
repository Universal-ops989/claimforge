"""Role-based access control.

Roles are coarse and cumulative (each includes everything below it); code only ever checks
*permissions*, so roles can be reshaped without touching call sites.

    viewer      read everything in the organization
    technician  + record field data (photos, moisture readings, equipment)
    adjuster    + create and edit claims, write and approve estimates, generate reports
    admin       + manage members and organization settings, delete claims, read the audit log
    owner       + delete the organization
"""

from enum import StrEnum
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.core.errors import NotFoundError, PermissionDeniedError
from claimforge_api.organizations.models import Organization
from claimforge_api.users.models import Membership, Role, User


class Permission(StrEnum):
    ORG_READ = "org:read"
    ORG_UPDATE = "org:update"
    ORG_DELETE = "org:delete"
    MEMBERS_READ = "members:read"
    MEMBERS_MANAGE = "members:manage"
    CLAIMS_READ = "claims:read"
    CLAIMS_WRITE = "claims:write"
    CLAIMS_DELETE = "claims:delete"
    FIELD_DATA_WRITE = "field_data:write"
    ESTIMATES_WRITE = "estimates:write"
    ESTIMATES_APPROVE = "estimates:approve"
    REPORTS_GENERATE = "reports:generate"
    AUDIT_READ = "audit:read"


_VIEWER = frozenset({Permission.ORG_READ, Permission.MEMBERS_READ, Permission.CLAIMS_READ})
_TECHNICIAN = _VIEWER | {Permission.FIELD_DATA_WRITE}
_ADJUSTER = _TECHNICIAN | {
    Permission.CLAIMS_WRITE,
    Permission.ESTIMATES_WRITE,
    Permission.ESTIMATES_APPROVE,
    Permission.REPORTS_GENERATE,
}
_ADMIN = _ADJUSTER | {
    Permission.ORG_UPDATE,
    Permission.MEMBERS_MANAGE,
    Permission.CLAIMS_DELETE,
    Permission.AUDIT_READ,
}
_OWNER = _ADMIN | {Permission.ORG_DELETE}

ROLE_PERMISSIONS: dict[Role, frozenset[Permission]] = {
    Role.VIEWER: _VIEWER,
    Role.TECHNICIAN: _TECHNICIAN,
    Role.ADJUSTER: _ADJUSTER,
    Role.ADMIN: _ADMIN,
    Role.OWNER: _OWNER,
}


def permissions_for(role: Role | str) -> frozenset[Permission]:
    return ROLE_PERMISSIONS[Role(role)]


def has_permission(role: Role | str, permission: Permission) -> bool:
    return permission in permissions_for(role)


async def authorize(
    session: AsyncSession, user: User, organization_id: UUID, permission: Permission
) -> Membership:
    """Return the user's membership if it grants ``permission``.

    Non-members get 404 so they cannot probe which organizations exist; members who lack
    the permission get 403, because they already know the organization exists.
    """
    membership = await session.scalar(
        select(Membership)
        .join(Organization, Organization.id == Membership.organization_id)
        .where(
            Membership.user_id == user.id,
            Membership.organization_id == organization_id,
            Organization.not_deleted(),
        )
    )
    if membership is None:
        raise NotFoundError("Organization not found", organization_id=str(organization_id))
    if not has_permission(membership.role, permission):
        raise PermissionDeniedError(
            f"Your role ({membership.role}) does not allow this action",
            required_permission=permission.value,
        )
    return membership
