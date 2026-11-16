"""HTTP endpoints for a claim's moisture points."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, status

from claimforge_api.api.deps import DbSession
from claimforge_api.api.problems import PROBLEM_RESPONSES
from claimforge_api.auth.deps import CurrentUser
from claimforge_api.moisture import service
from claimforge_api.moisture.schemas import (
    MoisturePointCreate,
    MoisturePointQuery,
    MoisturePointRead,
    MoisturePointUpdate,
)

router = APIRouter(
    prefix="/organizations/{organization_id}/claims/{claim_id}",
    tags=["moisture"],
    responses=PROBLEM_RESPONSES,
)


@router.get(
    "/moisture-points",
    summary="List a claim's moisture points",
    description="Room by room (in the order rooms were added), then by label: 2 before 10.",
)
async def list_moisture_points(
    organization_id: UUID,
    claim_id: UUID,
    session: DbSession,
    user: CurrentUser,
    query: Annotated[MoisturePointQuery, Query()],
) -> list[MoisturePointRead]:
    points = await service.list_points(session, organization_id, claim_id, query, user=user)
    return [MoisturePointRead.model_validate(p) for p in points]


@router.post(
    "/moisture-points",
    status_code=status.HTTP_201_CREATED,
    summary="Map a moisture point",
    description="Needs `field_data:write`. The room must be on this claim (`unknown_room`). "
    "Without a label the point gets the next number; labels are unique on the claim "
    "(`label_taken`). Closed and cancelled claims are read-only (`claim_locked`).",
)
async def create_moisture_point(
    organization_id: UUID,
    claim_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: MoisturePointCreate,
) -> MoisturePointRead:
    point = await service.create_point(session, organization_id, claim_id, body, user=user)
    return MoisturePointRead.model_validate(point)


@router.get("/moisture-points/{point_id}", summary="Get a moisture point")
async def get_moisture_point(
    organization_id: UUID, claim_id: UUID, point_id: UUID, session: DbSession, user: CurrentUser
) -> MoisturePointRead:
    point = await service.get_point(session, organization_id, claim_id, point_id, user=user)
    return MoisturePointRead.model_validate(point)


@router.patch(
    "/moisture-points/{point_id}",
    summary="Edit a moisture point",
    description="Only the fields sent change. The scale can't change: readings taken on "
    "two scales don't compare, so map a new point instead.",
)
async def update_moisture_point(
    organization_id: UUID,
    claim_id: UUID,
    point_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: MoisturePointUpdate,
) -> MoisturePointRead:
    point = await service.update_point(
        session, organization_id, claim_id, point_id, body, user=user
    )
    return MoisturePointRead.model_validate(point)


@router.delete(
    "/moisture-points/{point_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a moisture point",
)
async def delete_moisture_point(
    organization_id: UUID, claim_id: UUID, point_id: UUID, session: DbSession, user: CurrentUser
) -> None:
    await service.delete_point(session, organization_id, claim_id, point_id, user=user)
