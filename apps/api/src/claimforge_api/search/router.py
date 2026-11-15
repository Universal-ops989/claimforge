"""HTTP endpoint for global search."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query

from claimforge_api.api.deps import DbSession
from claimforge_api.api.problems import PROBLEM_RESPONSES
from claimforge_api.auth.deps import CurrentUser
from claimforge_api.search import service
from claimforge_api.search.schemas import SearchResults

router = APIRouter(
    prefix="/organizations/{organization_id}/search",
    tags=["search"],
    responses=PROBLEM_RESPONSES,
)


@router.get(
    "",
    summary="Search claims and contacts",
    description="Every word must appear, as a prefix, somewhere on a result: for a claim "
    "that includes its property, linked contacts and notes. Typing a claim number (ours or "
    "the carrier's) puts that claim first. Claims need `claims:read`, contacts "
    "`contacts:read`.",
)
async def search(
    organization_id: UUID,
    session: DbSession,
    user: CurrentUser,
    q: Annotated[str, Query(min_length=1, max_length=200, examples=["whitfield austin"])],
    limit: Annotated[int, Query(ge=1, le=25, description="Results per section")] = 5,
) -> SearchResults:
    return await service.search(session, organization_id, q, user=user, limit=limit)
