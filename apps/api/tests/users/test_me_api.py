import httpx2
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.core.settings import Settings
from claimforge_api.core.tokens import create_access_token
from claimforge_api.users import service as users
from claimforge_api.users.models import User

PASSWORD = "tile grout and drywall"
NEW_PASSWORD = "moisture map, then dry"


async def sign_in(client: httpx2.AsyncClient, password: str = PASSWORD) -> dict[str, str]:
    response = await client.post(
        "/v1/auth/login", json={"email": "member@example.com", "password": password}
    )
    assert response.status_code == 200, response.text
    tokens: dict[str, str] = response.json()
    return tokens


def bearer(tokens: dict[str, str]) -> dict[str, str]:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


async def test_a_name_is_changed_trimmed(
    auth_client: httpx2.AsyncClient, user: User, db_session: AsyncSession
) -> None:
    response = await auth_client.patch("/v1/me", json={"full_name": "  Morgan Rivera "})

    assert response.status_code == 200
    assert response.json()["full_name"] == "Morgan Rivera"
    await db_session.refresh(user)
    assert user.full_name == "Morgan Rivera"


async def test_a_blank_or_unknown_field_is_refused(auth_client: httpx2.AsyncClient) -> None:
    blank = await auth_client.patch("/v1/me", json={"full_name": "   "})
    email = await auth_client.patch("/v1/me", json={"email": "someone@else.example"})

    assert blank.status_code == 422
    assert email.status_code == 422


async def test_changing_the_password_signs_out_everywhere_else(
    client: httpx2.AsyncClient, user: User
) -> None:
    this = await sign_in(client)
    elsewhere = await sign_in(client)

    changed = await client.post(
        "/v1/me/password",
        json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
        headers=bearer(this),
    )
    body = changed.json()

    assert changed.status_code == 200
    assert changed.headers["cache-control"] == "no-store"
    # Both old sessions are over, including the one that made the change...
    for tokens in (this, elsewhere):
        refresh = await client.post(
            "/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
        )
        assert refresh.status_code == 401
    # ...which carries on with the new pair it was given.
    carried = await client.post("/v1/auth/refresh", json={"refresh_token": body["refresh_token"]})
    assert carried.status_code == 200
    # The new password signs in; the old one doesn't.
    await sign_in(client, NEW_PASSWORD)
    old = await client.post(
        "/v1/auth/login", json={"email": "member@example.com", "password": PASSWORD}
    )
    assert old.status_code == 401


async def test_a_wrong_current_password_is_422_and_changes_nothing(
    client: httpx2.AsyncClient, user: User
) -> None:
    tokens = await sign_in(client)

    wrong = await client.post(
        "/v1/me/password",
        json={"current_password": "not it at all", "new_password": NEW_PASSWORD},
        headers=bearer(tokens),
    )
    refresh = await client.post("/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})

    assert wrong.status_code == 422
    assert wrong.json()["code"] == "wrong_password"
    assert refresh.status_code == 200
    await sign_in(client)


async def test_the_new_password_must_meet_the_policy(
    auth_client: httpx2.AsyncClient, user: User
) -> None:
    short = await auth_client.post(
        "/v1/me/password", json={"current_password": PASSWORD, "new_password": "short"}
    )
    with_email = await auth_client.post(
        "/v1/me/password",
        json={"current_password": PASSWORD, "new_password": "member-password-123"},
    )

    assert short.status_code == 422
    assert short.json()["code"] == "weak_password"
    assert with_email.json()["code"] == "weak_password"


async def test_an_account_without_a_password_cant_change_one(
    client: httpx2.AsyncClient, db_session: AsyncSession, settings: Settings
) -> None:
    # Invited, not yet joined: no password to check against.
    invited = await users.create_user(
        db_session, email="invited@example.com", full_name="Not Yet Joined"
    )
    token = create_access_token(invited.id, settings).token

    response = await client.post(
        "/v1/me/password",
        json={"current_password": "anything at all", "new_password": NEW_PASSWORD},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422
    assert response.json()["code"] == "wrong_password"


async def test_both_need_a_signed_in_user(client: httpx2.AsyncClient) -> None:
    name = await client.patch("/v1/me", json={"full_name": "Anyone"})
    password = await client.post(
        "/v1/me/password", json={"current_password": PASSWORD, "new_password": NEW_PASSWORD}
    )

    assert (name.status_code, password.status_code) == (401, 401)


async def test_guessing_the_current_password_is_throttled(
    auth_client: httpx2.AsyncClient, user: User
) -> None:
    async def guess() -> httpx2.Response:
        return await auth_client.post(
            "/v1/me/password",
            json={"current_password": "a wrong guess", "new_password": NEW_PASSWORD},
        )

    statuses = [(await guess()).status_code for _ in range(5)]
    throttled = await guess()

    assert statuses == [422] * 5
    assert throttled.status_code == 429
    assert throttled.json()["code"] == "rate_limited"
