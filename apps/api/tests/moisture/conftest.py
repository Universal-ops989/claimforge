"""Shared by the moisture tests: a claim's moisture map, as one technician draws it."""

from typing import Any
from uuid import UUID

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.claims import service as claims
from claimforge_api.claims.models import Claim
from claimforge_api.claims.schemas import ClaimCreate
from claimforge_api.moisture import service
from claimforge_api.moisture.models import MoisturePoint
from claimforge_api.moisture.schemas import MoisturePointCreate, MoisturePointUpdate
from claimforge_api.structures import service as structures
from claimforge_api.structures.models import Room, Structure
from claimforge_api.structures.schemas import RoomCreate, StructureCreate
from claimforge_api.users.models import User

ADDRESS = {"line1": "123 Main St", "city": "Austin", "region": "TX", "postal_code": "78701"}


class Map:
    """A claim's moisture map, as one technician draws it."""

    def __init__(
        self, session: AsyncSession, organization_id: UUID, claim: Claim, user: User
    ) -> None:
        self.session, self.organization_id, self.claim, self.user = (
            session,
            organization_id,
            claim,
            user,
        )

    async def structure(self, name: str = "House") -> Structure:
        return await structures.create_structure(
            self.session,
            self.organization_id,
            self.claim.id,
            StructureCreate(name=name),
            user=self.user,
        )

    async def room(self, name: str, structure: Structure | None = None) -> Room:
        structure = structure or await self.structure(f"{name} wing")
        return await structures.create_room(
            self.session,
            self.organization_id,
            self.claim.id,
            structure.id,
            RoomCreate(name=name),
            user=self.user,
        )

    async def point(self, room: Room, **fields: Any) -> MoisturePoint:
        body = {
            "room_id": str(room.id),
            "material": "Drywall",
            "surface": "wall",
            "scale": "percent",
        } | fields
        return await service.create_point(
            self.session,
            self.organization_id,
            self.claim.id,
            MoisturePointCreate.model_validate(body),
            user=self.user,
        )

    async def edit(self, point: MoisturePoint, **fields: Any) -> MoisturePoint:
        return await service.update_point(
            self.session,
            self.organization_id,
            self.claim.id,
            point.id,
            MoisturePointUpdate.model_validate(fields),
            user=self.user,
        )

    async def labels(self) -> list[str]:
        points = await service.list_points(
            self.session, self.organization_id, self.claim.id, user=self.user
        )
        return [p.label for p in points]


async def open_map(session: AsyncSession, organization_id: UUID, user: User) -> Map:
    data = ClaimCreate.model_validate({"loss_type": "water", "property": {"address": ADDRESS}})
    claim = await claims.create_claim(session, organization_id, data, user=user)
    return Map(session, organization_id, claim, user)


@pytest.fixture
async def moisture_map(db_session: AsyncSession, organization_id: UUID, user: User) -> Map:
    return await open_map(db_session, organization_id, user)
