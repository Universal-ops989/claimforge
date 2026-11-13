import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.core import passwords
from claimforge_api.users import service

PASSWORD = "tile grout and drywall"


@pytest.fixture(autouse=True)
def fast_hasher(monkeypatch: pytest.MonkeyPatch) -> None:
    """Production scrypt cost is ~0.3s per hash; tests use a cheap one."""
    monkeypatch.setattr(passwords, "hasher", passwords.PasswordHasher(log_n=10))


async def test_create_user_normalizes_email_and_hashes_password(db_session: AsyncSession) -> None:
    user = await service.create_user(
        db_session, email="  Ana@Example.COM ", full_name=" Ana Rivera ", password=PASSWORD
    )

    assert user.email == "ana@example.com"
    assert user.full_name == "Ana Rivera"
    assert user.password_hash is not None
    assert PASSWORD not in user.password_hash


async def test_duplicate_email_is_rejected(db_session: AsyncSession) -> None:
    await service.create_user(db_session, email="ana@example.com", full_name="Ana")

    with pytest.raises(service.EmailTakenError):
        await service.create_user(db_session, email="ANA@example.com", full_name="Other")


async def test_weak_passwords_are_a_business_rule_error(db_session: AsyncSession) -> None:
    with pytest.raises(service.PasswordPolicyError, match="at least 12"):
        await service.create_user(
            db_session, email="ana@example.com", full_name="Ana", password="short"
        )


async def test_authenticate_succeeds_and_records_login(db_session: AsyncSession) -> None:
    await service.create_user(
        db_session, email="ana@example.com", full_name="Ana", password=PASSWORD
    )

    user = await service.authenticate(db_session, "ANA@example.com", PASSWORD)

    assert user.email == "ana@example.com"
    assert user.last_login_at is not None


async def test_authenticate_upgrades_outdated_hashes(db_session: AsyncSession) -> None:
    user = await service.create_user(db_session, email="old@example.com", full_name="Old")
    user.password_hash = passwords.PasswordHasher(log_n=9).hash(PASSWORD)
    await db_session.commit()

    await service.authenticate(db_session, "old@example.com", PASSWORD)

    assert user.password_hash.startswith("$scrypt$ln=10,")


async def test_all_failures_look_identical(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    await service.create_user(
        db_session, email="ana@example.com", full_name="Ana", password=PASSWORD
    )
    inactive = await service.create_user(
        db_session, email="off@example.com", full_name="Off", password=PASSWORD
    )
    inactive.is_active = False
    invited = await service.create_user(db_session, email="new@example.com", full_name="New")
    await db_session.commit()

    dummy_checks: list[str] = []
    monkeypatch.setattr(passwords, "verify_dummy", dummy_checks.append)

    failures = [
        ("nobody@example.com", PASSWORD),  # unknown email
        ("ana@example.com", "wrong password here"),  # wrong password
        ("off@example.com", PASSWORD),  # inactive account
        (invited.email, PASSWORD),  # no password set yet
    ]
    for email, password in failures:
        with pytest.raises(service.InvalidCredentialsError) as caught:
            await service.authenticate(db_session, email, password)
        assert caught.value.code == "invalid_credentials"
        assert caught.value.detail == "Invalid email or password"

    # Unknown and password-less accounts still ran a hash check (no timing oracle).
    assert len(dummy_checks) == 2
