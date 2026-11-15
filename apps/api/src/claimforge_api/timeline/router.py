"""HTTP endpoint for a claim's timeline."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query

from claimforge_api.api.deps import DbSession, PageParamsDep
from claimforge_api.api.problems import PROBLEM_RESPONSES
from claimforge_api.auth.deps import CurrentUser
from claimforge_api.db.pagination import CursorPage
from claimforge_api.timeline import service
from claimforge_api.timeline.schemas import TimelineEntry, TimelineQuery

router = APIRouter(
    prefix="/organizations/{organization_id}/claims/{claim_id}",
    tags=["timeline"],
    responses=PROBLEM_RESPONSES,
)


@router.get(
    "/timeline",
    summary="A claim's timeline",
    description="Everything that happened on the claim and the records under it, newest "
    "first, each with a one-line summary. Needs `claims:read` (the raw audit log needs "
    "`audit:read`).",
)
async def claim_timeline(
    organization_id: UUID,
    claim_id: UUID,
    session: DbSession,
    user: CurrentUser,
    page: PageParamsDep,
    query: Annotated[TimelineQuery, Query()],
) -> CursorPage[TimelineEntry]:
    result = await service.claim_timeline(
        session, organization_id, claim_id, query, user=user, limit=page.limit, cursor=page.cursor
    )
    return CursorPage[TimelineEntry](
        items=result.items, next_cursor=result.next_cursor, has_more=result.has_more
    )
