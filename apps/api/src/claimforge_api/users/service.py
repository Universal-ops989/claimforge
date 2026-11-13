"""User accounts and credential checks."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.core import passwords
from claimforge_api.core.errors import AuthenticationRequiredError, BusinessRuleError, ConflictError
from claimforge_api.users.models import User


class EmailTakenError(ConflictError):
    code = "email_taken"
    title = "Email already registered"


class InvalidCredentialsError(AuthenticationRequiredError):
    """Deliberately vague: never reveals whether the email exists."""

    code = "invalid_credentials"
    title = "Invalid email or password"


class PasswordPolicyError(BusinessRuleError):
    code = "weak_password"
    title = "Password does not meet the policy"


def normalize_email(email: str) -> str:
    return email.strip().lower()


async def find_live_user_by_email(session: AsyncSession, email: str) -> User | None:
    return await session.scalar(
        select(User).where(
            func.lower(User.email) == normalize_email(email),
            User.not_deleted(),
        )
    )


async def create_user(
    session: AsyncSession, *, email: str, full_name: str, password: str | None = None
) -> User:
    email = normalize_email(email)
    if await find_live_user_by_email(session, email) is not None:
        raise EmailTakenError("An account with this email already exists", email=email)

    user = User(email=email, full_name=full_name.strip())
    if password is not None:
        _apply_password(user, password)
    session.add(user)
    try:
        await session.flush()
    except IntegrityError as exc:  # lost a race with a concurrent signup
        await session.rollback()
        raise EmailTakenError("An account with this email already exists", email=email) from exc
    await session.commit()
    return user


def _apply_password(user: User, password: str) -> None:
    try:
        passwords.check_password_policy(password, email=user.email)
    except passwords.WeakPasswordError as exc:
        raise PasswordPolicyError(str(exc)) from exc
    user.password_hash = passwords.hasher.hash(password)


async def set_password(session: AsyncSession, user_id: UUID, password: str) -> None:
    user = await session.get(User, user_id)
    if user is None or user.is_deleted:
        raise InvalidCredentialsError()
    _apply_password(user, password)
    await session.commit()


async def authenticate(session: AsyncSession, email: str, password: str) -> User:
    """Return the user for valid credentials, else raise InvalidCredentialsError.

    Every failure takes about as long as a real check: unknown emails still run one hash
    verification, so response times don't reveal which accounts exist.
    """
    user = await find_live_user_by_email(session, email)
    if user is None or user.password_hash is None:
        passwords.verify_dummy(password)
        raise InvalidCredentialsError()

    if not passwords.hasher.verify(password, user.password_hash) or not user.is_active:
        raise InvalidCredentialsError()

    if passwords.hasher.needs_rehash(user.password_hash):
        user.password_hash = passwords.hasher.hash(password)
    user.last_login_at = datetime.now(UTC)
    await session.commit()
    return user
