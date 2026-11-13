from uuid import UUID

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.organizations import service as organizations
from claimforge_api.organizations.schemas import OrganizationCreate
from claimforge_api.users.models import User


@pytest.fixture
async def organization_id(db_session: AsyncSession, user: User) -> UUID:
    """An organization owned by ``user``."""
    organization = await organizations.create_organization(
        db_session, OrganizationCreate(name="Rivera Restoration"), owner=user
    )
    return organization.id
