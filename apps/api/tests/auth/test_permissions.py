import itertools

import pytest

from claimforge_api.auth.permissions import (
    ROLE_PERMISSIONS,
    Permission,
    has_permission,
    permissions_for,
)
from claimforge_api.users.models import Role

P = Permission

# The full matrix, written out so any change to who can do what is a visible diff.
EXPECTED: dict[Role, set[Permission]] = {
    Role.VIEWER: {P.ORG_READ, P.MEMBERS_READ, P.CLAIMS_READ},
    Role.TECHNICIAN: {P.ORG_READ, P.MEMBERS_READ, P.CLAIMS_READ, P.FIELD_DATA_WRITE},
    Role.ADJUSTER: {
        P.ORG_READ,
        P.MEMBERS_READ,
        P.CLAIMS_READ,
        P.FIELD_DATA_WRITE,
        P.CLAIMS_WRITE,
        P.ESTIMATES_WRITE,
        P.ESTIMATES_APPROVE,
        P.REPORTS_GENERATE,
    },
    Role.ADMIN: set(Permission) - {P.ORG_DELETE},
    Role.OWNER: set(Permission),
}


@pytest.mark.parametrize("role", list(Role))
def test_matrix(role: Role) -> None:
    assert set(permissions_for(role)) == EXPECTED[role]


def test_every_role_is_mapped() -> None:
    assert set(ROLE_PERMISSIONS) == set(Role)


def test_roles_are_cumulative() -> None:
    ladder = [Role.VIEWER, Role.TECHNICIAN, Role.ADJUSTER, Role.ADMIN, Role.OWNER]
    for lower, higher in itertools.pairwise(ladder):
        assert permissions_for(lower) < permissions_for(higher), f"{lower} ⊄ {higher}"


def test_only_owners_can_delete_the_organization() -> None:
    assert [r for r in Role if has_permission(r, P.ORG_DELETE)] == [Role.OWNER]


def test_accepts_role_strings_from_the_database() -> None:
    assert has_permission("technician", P.FIELD_DATA_WRITE)
    assert not has_permission("viewer", P.CLAIMS_WRITE)
