from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.auth import refresh_tokens
from claimforge_api.auth.models import RefreshToken
from claimforge_api.core.settings import Settings
from claimforge_api.users.models import User


@pytest.fixture
async def user(db_session: AsyncSession) -> User:
    user = User(email="tech@example.com", full_name="Field Tech")
    db_session.add(user)
    await db_session.flush()
    return user


async def family_states(session: AsyncSession, family_id: object) -> list[bool]:
    rows = await session.scalars(
        select(RefreshToken).where(RefreshToken.family_id == family_id).order_by(RefreshToken.id)
    )
    return [row.revoked_at is not None for row in rows]


async def test_only_a_hash_is_stored(
    db_session: AsyncSession, user: User, settings: Settings
) -> None:
    issued = await refresh_tokens.issue(db_session, user.id, settings, user_agent="Pixel 9")

    assert issued.record.token_hash == refresh_tokens.hash_token(issued.token)
    assert issued.token not in issued.record.token_hash
    assert issued.record.user_agent == "Pixel 9"
    assert issued.record.expires_at - datetime.now(UTC) > timedelta(days=29)


async def test_rotation_replaces_the_token_in_the_same_family(
    db_session: AsyncSession, user: User, settings: Settings
) -> None:
    first = await refresh_tokens.issue(db_session, user.id, settings)

    rotated_user, second = await refresh_tokens.rotate(db_session, first.token, settings)

    assert rotated_user.id == user.id
    assert second.token != first.token
    assert second.record.family_id == first.record.family_id
    assert first.record.replaced_by_id == second.record.id
    assert await family_states(db_session, first.record.family_id) == [True, False]


async def test_reusing_a_rotated_token_revokes_the_whole_family(
    db_session: AsyncSession, user: User, settings: Settings
) -> None:
    stolen = await refresh_tokens.issue(db_session, user.id, settings)
    _, legitimate = await refresh_tokens.rotate(db_session, stolen.token, settings)

    with pytest.raises(refresh_tokens.RefreshTokenReusedError):
        await refresh_tokens.rotate(db_session, stolen.token, settings)

    # Even the newest token in the family no longer works.
    assert await family_states(db_session, stolen.record.family_id) == [True, True]
    with pytest.raises(refresh_tokens.RefreshTokenReusedError):
        await refresh_tokens.rotate(db_session, legitimate.token, settings)


async def test_unknown_tokens_are_rejected(db_session: AsyncSession, settings: Settings) -> None:
    with pytest.raises(refresh_tokens.InvalidRefreshTokenError):
        await refresh_tokens.rotate(db_session, "made-up", settings)


async def test_expired_tokens_are_rejected(
    db_session: AsyncSession, user: User, settings: Settings
) -> None:
    long_ago = datetime.now(UTC) - timedelta(days=60)
    old = await refresh_tokens.issue(db_session, user.id, settings, now=long_ago)

    with pytest.raises(refresh_tokens.InvalidRefreshTokenError):
        await refresh_tokens.rotate(db_session, old.token, settings)


async def test_deactivated_users_cannot_refresh(
    db_session: AsyncSession, user: User, settings: Settings
) -> None:
    issued = await refresh_tokens.issue(db_session, user.id, settings)
    user.is_active = False
    await db_session.flush()

    with pytest.raises(refresh_tokens.InvalidRefreshTokenError):
        await refresh_tokens.rotate(db_session, issued.token, settings)
    assert await family_states(db_session, issued.record.family_id) == [True]


async def test_revoke_signs_out_the_session_only(
    db_session: AsyncSession, user: User, settings: Settings
) -> None:
    laptop = await refresh_tokens.issue(db_session, user.id, settings)
    phone = await refresh_tokens.issue(db_session, user.id, settings)

    await refresh_tokens.revoke(db_session, laptop.token)
    await refresh_tokens.revoke(db_session, "unknown-is-fine")

    assert await family_states(db_session, laptop.record.family_id) == [True]
    assert await family_states(db_session, phone.record.family_id) == [False]


async def test_revoke_all_signs_out_everywhere(
    db_session: AsyncSession, user: User, settings: Settings
) -> None:
    laptop = await refresh_tokens.issue(db_session, user.id, settings)
    phone = await refresh_tokens.issue(db_session, user.id, settings)

    await refresh_tokens.revoke_all_for_user(db_session, user.id)

    assert await family_states(db_session, laptop.record.family_id) == [True]
    assert await family_states(db_session, phone.record.family_id) == [True]
