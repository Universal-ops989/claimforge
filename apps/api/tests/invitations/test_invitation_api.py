import httpx2
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from tests.invitations.conftest import RecordingSender

from claimforge_api.users import service as users

PASSWORD = "tile grout and drywall"


@pytest.fixture
async def org_id(auth_client: httpx2.AsyncClient) -> str:
    response = await auth_client.post("/v1/organizations", json={"name": "Rivera Restoration"})
    org_id: str = response.json()["id"]
    return org_id


async def test_invite_accept_and_sign_in_end_to_end(
    auth_client: httpx2.AsyncClient,
    client: httpx2.AsyncClient,
    org_id: str,
    sender: RecordingSender,
) -> None:
    # The owner invites a technician; the response never contains the token.
    invited = await auth_client.post(
        f"/v1/organizations/{org_id}/invitations",
        json={"email": "tom@example.com", "role": "technician"},
    )
    assert invited.status_code == 201
    assert "token" not in invited.text
    assert sender.messages[-1].email == "tom@example.com"

    # The invitee follows the emailed link, chooses a password and is signed in.
    accepted = await client.post(
        "/v1/invitations/accept",
        json={"token": sender.last_token, "full_name": "Tom Okafor", "password": PASSWORD},
    )
    assert accepted.status_code == 200
    assert accepted.headers["cache-control"] == "no-store"
    access_token = accepted.json()["access_token"]

    me = await client.get("/v1/me", headers={"Authorization": f"Bearer {access_token}"})
    [membership] = me.json()["memberships"]
    assert me.json()["full_name"] == "Tom Okafor"
    assert membership["organization"]["id"] == org_id
    assert membership["role"] == "technician"

    # They can sign in normally afterwards, and the invitation is used up.
    login = await client.post(
        "/v1/auth/login", json={"email": "tom@example.com", "password": PASSWORD}
    )
    assert login.status_code == 200
    reused = await client.post(
        "/v1/invitations/accept", json={"token": sender.last_token, "password": PASSWORD}
    )
    assert reused.status_code == 410
    assert reused.json()["code"] == "invitation_unavailable"


async def test_list_and_revoke(
    auth_client: httpx2.AsyncClient, org_id: str, sender: RecordingSender
) -> None:
    created = await auth_client.post(
        f"/v1/organizations/{org_id}/invitations",
        json={"email": "pending@example.com", "role": "viewer"},
    )
    invitation_id = created.json()["id"]

    listed = await auth_client.get(f"/v1/organizations/{org_id}/invitations")
    assert [i["email"] for i in listed.json()] == ["pending@example.com"]

    revoked = await auth_client.delete(f"/v1/organizations/{org_id}/invitations/{invitation_id}")
    assert revoked.status_code == 204
    assert (await auth_client.get(f"/v1/organizations/{org_id}/invitations")).json() == []


async def test_existing_user_must_be_signed_in_to_accept(
    auth_client: httpx2.AsyncClient,
    client: httpx2.AsyncClient,
    db_session: AsyncSession,
    org_id: str,
    sender: RecordingSender,
) -> None:
    await users.create_user(
        db_session, email="ia@example.com", full_name="Independent Adjuster", password=PASSWORD
    )
    await auth_client.post(
        f"/v1/organizations/{org_id}/invitations",
        json={"email": "ia@example.com", "role": "adjuster"},
    )
    token = sender.last_token

    signed_out = await client.post("/v1/invitations/accept", json={"token": token})
    assert signed_out.status_code == 409
    assert signed_out.json()["code"] == "sign_in_to_accept"

    login = await client.post(
        "/v1/auth/login", json={"email": "ia@example.com", "password": PASSWORD}
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    signed_in = await client.post("/v1/invitations/accept", json={"token": token}, headers=headers)

    assert signed_in.status_code == 200
    roles = [m["role"] for m in (await client.get("/v1/me", headers=headers)).json()["memberships"]]
    assert roles == ["adjuster"]


async def test_invalid_input_and_permissions(
    auth_client: httpx2.AsyncClient, client: httpx2.AsyncClient, org_id: str
) -> None:
    bad_email = await auth_client.post(
        f"/v1/organizations/{org_id}/invitations", json={"email": "nope", "role": "viewer"}
    )
    bad_role = await auth_client.post(
        f"/v1/organizations/{org_id}/invitations",
        json={"email": "a@example.com", "role": "superuser"},
    )
    anonymous = await client.post(
        f"/v1/organizations/{org_id}/invitations", json={"email": "a@example.com", "role": "viewer"}
    )

    assert bad_email.status_code == 422
    assert bad_role.status_code == 422
    assert anonymous.status_code == 401
