"""Listing an organization's members, over HTTP."""

from uuid import UUID

import httpx2
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from tests.conftest import ClientFor

from claimforge_api.auth.permissions import permissions_for
from claimforge_api.organizations import service as organizations
from claimforge_api.organizations.schemas import OrganizationCreate
from claimforge_api.users import service as users
from claimforge_api.users.models import Membership, Role, User


def members_url(organization_id: UUID) -> str:
    return f"/v1/organizations/{organization_id}/members"


async def add_member(
    session: AsyncSession, organization_id: UUID, *, email: str, full_name: str, role: Role
) -> User:
    person = await users.create_user(session, email=email, full_name=full_name)
    session.add(Membership(organization_id=organization_id, user_id=person.id, role=role))
    await session.commit()
    return person


async def test_lists_everyone_by_name_with_role_and_permissions(
    auth_client: httpx2.AsyncClient, db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    riley = await add_member(
        db_session,
        organization_id,
        email="riley@example.com",
        full_name="riley Tech",
        role=Role.TECHNICIAN,
    )
    await add_member(
        db_session,
        organization_id,
        email="avery@example.com",
        full_name="Avery Adjuster",
        role=Role.ADJUSTER,
    )

    response = await auth_client.get(members_url(organization_id))

    assert response.status_code == 200
    members = response.json()
    # By name, ignoring case: "riley" sorts after "Morgan".
    assert [m["user"]["full_name"] for m in members] == [
        "Avery Adjuster",
        "Morgan Member",
        "riley Tech",
    ]
    technician = members[2]
    assert technician["user"] == {"id": str(riley.id), "full_name": "riley Tech"}
    assert technician["role"] == "technician"
    assert technician["permissions"] == sorted(permissions_for(Role.TECHNICIAN))
    assert technician["joined_at"]
    assert members[1]["role"] == "owner"
    assert members[1]["user"]["id"] == str(user.id)


async def test_never_shows_emails(auth_client: httpx2.AsyncClient, organization_id: UUID) -> None:
    response = await auth_client.get(members_url(organization_id))

    assert "@" not in response.text
    assert set(response.json()[0]) == {"user", "role", "permissions", "joined_at"}
    assert set(response.json()[0]["user"]) == {"id", "full_name"}


@pytest.mark.parametrize("role", list(Role))
async def test_every_role_can_see_who_is_in_it(
    client_for: ClientFor, organization_id: UUID, role: Role
) -> None:
    client = await client_for(role)

    response = await client.get(members_url(organization_id))

    assert response.status_code == 200
    assert len(response.json()) == 2  # the owner and this member


async def test_outsiders_cannot_tell_the_organization_exists(
    client_for: ClientFor, organization_id: UUID
) -> None:
    outsider = await client_for(None)

    response = await outsider.get(members_url(organization_id))

    assert response.status_code == 404


async def test_needs_signing_in(client: httpx2.AsyncClient, organization_id: UUID) -> None:
    response = await client.get(members_url(organization_id))

    assert response.status_code == 401


async def test_leaves_out_deleted_users(
    auth_client: httpx2.AsyncClient, db_session: AsyncSession, organization_id: UUID
) -> None:
    gone = await add_member(
        db_session,
        organization_id,
        email="gone@example.com",
        full_name="Gone Away",
        role=Role.VIEWER,
    )
    gone.soft_delete()
    await db_session.commit()

    response = await auth_client.get(members_url(organization_id))

    assert [m["user"]["full_name"] for m in response.json()] == ["Morgan Member"]


async def test_only_this_organization(
    auth_client: httpx2.AsyncClient, db_session: AsyncSession, organization_id: UUID, user: User
) -> None:
    other = await organizations.create_organization(
        db_session, OrganizationCreate(name="Elsewhere Dry-Out"), owner=user
    )
    await add_member(
        db_session,
        other.id,
        email="elsewhere@example.com",
        full_name="Elsewhere Person",
        role=Role.ADJUSTER,
    )

    response = await auth_client.get(members_url(organization_id))

    assert [m["user"]["full_name"] for m in response.json()] == ["Morgan Member"]
