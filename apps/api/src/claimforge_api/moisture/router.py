"""HTTP endpoints for a claim's moisture points, monitoring visits and drying log."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, status

from claimforge_api.api.deps import DbSession, PageParamsDep
from claimforge_api.api.problems import PROBLEM_RESPONSES
from claimforge_api.auth.deps import CurrentUser
from claimforge_api.db.pagination import CursorPage
from claimforge_api.moisture import service
from claimforge_api.moisture.schemas import (
    DryingLog,
    DryingLogQuery,
    MoistureLogCreate,
    MoistureLogRead,
    MoistureLogUpdate,
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


# ─── Monitoring visits and the drying log ─────────────────────────────────────


@router.get(
    "/moisture-logs",
    summary="List a claim's moisture logs",
    description="Monitoring visits, most recent first, each with its readings.",
)
async def list_moisture_logs(
    organization_id: UUID,
    claim_id: UUID,
    session: DbSession,
    user: CurrentUser,
    page: PageParamsDep,
) -> CursorPage[MoistureLogRead]:
    result = await service.list_logs(
        session, organization_id, claim_id, user=user, limit=page.limit, cursor=page.cursor
    )
    return CursorPage[MoistureLogRead](
        items=[service.present_log(log) for log in result.items],
        next_cursor=result.next_cursor,
        has_more=result.has_more,
    )


@router.post(
    "/moisture-logs",
    status_code=status.HTTP_201_CREATED,
    summary="Log moisture readings",
    description="Needs `field_data:write`. One visit: a reading for each point read, on the "
    "point's own scale. `taken_at` defaults to now and can be earlier when readings are "
    "entered later, but not in the future (`taken_in_future`). Every point must be on this "
    "claim (`unknown_moisture_point`, with `point_ids`).",
)
async def create_moisture_log(
    organization_id: UUID,
    claim_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: MoistureLogCreate,
) -> MoistureLogRead:
    log = await service.create_log(session, organization_id, claim_id, body, user=user)
    return service.present_log(log)


@router.get("/moisture-logs/{log_id}", summary="Get a moisture log")
async def get_moisture_log(
    organization_id: UUID, claim_id: UUID, log_id: UUID, session: DbSession, user: CurrentUser
) -> MoistureLogRead:
    log = await service.get_log(session, organization_id, claim_id, log_id, user=user)
    return service.present_log(log)


@router.patch(
    "/moisture-logs/{log_id}",
    summary="Correct a moisture log",
    description="Only the fields sent change. Each entry in `readings` sets a point's value "
    "on this visit (adding it if the point wasn't read); `value: null` removes it. A visit "
    "keeps at least one reading (`no_readings`): delete it instead.",
)
async def update_moisture_log(
    organization_id: UUID,
    claim_id: UUID,
    log_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: MoistureLogUpdate,
) -> MoistureLogRead:
    log = await service.update_log(session, organization_id, claim_id, log_id, body, user=user)
    return service.present_log(log)


@router.delete(
    "/moisture-logs/{log_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a moisture log and its readings",
)
async def delete_moisture_log(
    organization_id: UUID, claim_id: UUID, log_id: UUID, session: DbSession, user: CurrentUser
) -> None:
    await service.delete_log(session, organization_id, claim_id, log_id, user=user)


@router.get(
    "/drying-log",
    summary="The claim's drying log",
    description="The monitoring table: points down the side (grouped by room), visits "
    "across the top (oldest first), each point's value per visit, or null where it wasn't "
    "read. With `room_id`, only that room's points and the visits that read them.",
)
async def get_drying_log(
    organization_id: UUID,
    claim_id: UUID,
    session: DbSession,
    user: CurrentUser,
    query: Annotated[DryingLogQuery, Query()],
) -> DryingLog:
    return await service.drying_log(session, organization_id, claim_id, query, user=user)
