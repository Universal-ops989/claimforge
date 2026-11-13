from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tests.invitations.conftest import RecordingSender

from claimforge_api.core.errors import NotFoundError, PermissionDeniedError
from claimforge_api.core.settings import Settings
from claimforge_api.invitations import service
from claimforge_api.invitations.models import Invitation
from claimforge_api.organizations import service as organizations
from claimforge_api.organizations.schemas import OrganizationCreate
from claimforge_api.users import service as users
from claimforge_api.users.models import Membership, Role, User

PASSWORD = "tile grout and drywall"


@pytest.fixture
async def org_id(db_session: AsyncSession, user: User) -> UUID:
    org = await organizations.create_organization(
        db_session, OrganizationCreate(name="Rivera Restoration"), owner=user
    )
    return org.id


async def invite(
    session: AsyncSession,
    inviter: User,
    org_id: UUID,
    settings: Settings,
    sender: RecordingSender,
    email: str = "new.tech@example.com",
    role: Role = Role.TECHNICIAN,
) -> Invitation:
    return await service.invite(
        session,
        inviter=inviter,
        organization_id=org_id,
        email=email,
        role=role,
        settings=settings,
        sender=sender,
    )


async def test_sends_a_link_but_stores_only_a_hash(
    db_session: AsyncSession, user: User, org_id: UUID, settings: Settings, sender: RecordingSender
) -> None:
    invitation = await invite(
        db_session, user, org_id, settings, sender, email="New.Tech@Example.com"
    )

    [message] = sender.messages
    assert message.email == "new.tech@example.com"
    assert message.organization_name == "Rivera Restoration"
    assert message.accept_url.startswith(f"{settings.web_app_url}/invitations/accept?token=")
    assert sender.last_token not in invitation.token_hash
    assert invitation.expires_at - datetime.now(UTC) > timedelta(days=6)


async def test_reinviting_reissues_the_pending_invitation(
    db_session: AsyncSession, user: User, org_id: UUID, settings: Settings, sender: RecordingSender
) -> None:
    first = await invite(db_session, user, org_id, settings, sender)
    first_token = sender.last_token
    second = await invite(db_session, user, org_id, settings, sender, role=Role.ADJUSTER)

    assert second.id == first.id
    assert second.role == Role.ADJUSTER
    assert sender.last_token != first_token
    with pytest.raises(service.InvitationUnavailableError):
        await service.accept(db_session, token=first_token, current_user=None, password=PASSWORD)


async def test_requires_members_manage(
    db_session: AsyncSession, user: User, org_id: UUID, settings: Settings, sender: RecordingSender
) -> None:
    viewer = await users.create_user(db_session, email="viewer@example.com", full_name="Viewer")
    db_session.add(Membership(organization_id=org_id, user_id=viewer.id, role=Role.VIEWER))
    await db_session.commit()

    with pytest.raises(PermissionDeniedError):
        await invite(db_session, viewer, org_id, settings, sender)


async def test_cannot_grant_more_than_you_have(
    db_session: AsyncSession, user: User, org_id: UUID, settings: Settings, sender: RecordingSender
) -> None:
    admin = await users.create_user(db_session, email="admin@example.com", full_name="Admin")
    db_session.add(Membership(organization_id=org_id, user_id=admin.id, role=Role.ADMIN))
    await db_session.commit()

    with pytest.raises(PermissionDeniedError, match="cannot invite someone as owner"):
        await invite(db_session, admin, org_id, settings, sender, role=Role.OWNER)
    await invite(db_session, admin, org_id, settings, sender, role=Role.ADMIN)


async def test_existing_members_cannot_be_invited(
    db_session: AsyncSession, user: User, org_id: UUID, settings: Settings, sender: RecordingSender
) -> None:
    with pytest.raises(service.AlreadyMemberError):
        await invite(db_session, user, org_id, settings, sender, email=user.email.upper())


async def test_new_person_accepts_by_creating_an_account(
    db_session: AsyncSession, user: User, org_id: UUID, settings: Settings, sender: RecordingSender
) -> None:
    await invite(db_session, user, org_id, settings, sender)

    joined = await service.accept(
        db_session,
        token=sender.last_token,
        current_user=None,
        full_name="Tom Okafor",
        password=PASSWORD,
    )

    assert joined.email == "new.tech@example.com"
    assert joined.full_name == "Tom Okafor"
    role = await db_session.scalar(
        select(Membership.role).where(
            Membership.user_id == joined.id, Membership.organization_id == org_id
        )
    )
    assert role == "technician"
    # Single use.
    with pytest.raises(service.InvitationUnavailableError):
        await service.accept(db_session, token=sender.last_token, current_user=joined)


async def test_new_person_must_choose_a_password(
    db_session: AsyncSession, user: User, org_id: UUID, settings: Settings, sender: RecordingSender
) -> None:
    await invite(db_session, user, org_id, settings, sender)

    with pytest.raises(service.PasswordRequiredError):
        await service.accept(db_session, token=sender.last_token, current_user=None)


async def test_existing_account_must_sign_in_as_the_invitee(
    db_session: AsyncSession, user: User, org_id: UUID, settings: Settings, sender: RecordingSender
) -> None:
    invitee = await users.create_user(
        db_session, email="ia@example.com", full_name="Independent Adjuster", password=PASSWORD
    )
    someone_else = await users.create_user(db_session, email="else@example.com", full_name="Else")
    await invite(db_session, user, org_id, settings, sender, email="ia@example.com")
    token = sender.last_token

    with pytest.raises(service.SignInRequiredError):
        await service.accept(db_session, token=token, current_user=None)
    with pytest.raises(service.InvitationAccountMismatchError):
        await service.accept(db_session, token=token, current_user=someone_else)

    joined = await service.accept(db_session, token=token, current_user=invitee)
    assert joined.id == invitee.id


async def test_expired_and_revoked_invitations_cannot_be_used(
    db_session: AsyncSession, user: User, org_id: UUID, settings: Settings, sender: RecordingSender
) -> None:
    expired = await invite(db_session, user, org_id, settings, sender, email="late@example.com")
    expired_token = sender.last_token
    expired.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    revoked = await invite(db_session, user, org_id, settings, sender, email="gone@example.com")
    revoked_token = sender.last_token
    await db_session.commit()

    await service.revoke(db_session, user=user, organization_id=org_id, invitation_id=revoked.id)

    for token in (expired_token, revoked_token, "made-up"):
        with pytest.raises(service.InvitationUnavailableError):
            await service.accept(db_session, token=token, current_user=None, password=PASSWORD)
    with pytest.raises(NotFoundError):
        await service.revoke(
            db_session, user=user, organization_id=org_id, invitation_id=revoked.id
        )


async def test_lists_only_pending_invitations(
    db_session: AsyncSession, user: User, org_id: UUID, settings: Settings, sender: RecordingSender
) -> None:
    await invite(db_session, user, org_id, settings, sender, email="a@example.com")
    gone = await invite(db_session, user, org_id, settings, sender, email="b@example.com")
    await service.revoke(db_session, user=user, organization_id=org_id, invitation_id=gone.id)

    pending = await service.list_pending(db_session, user=user, organization_id=org_id)

    assert [i.email for i in pending] == ["a@example.com"]
