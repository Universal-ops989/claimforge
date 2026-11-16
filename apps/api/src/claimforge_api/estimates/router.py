"""HTTP endpoints for a claim's estimates and their lines."""

from uuid import UUID

from fastapi import APIRouter, status

from claimforge_api.api.deps import DbSession
from claimforge_api.api.problems import PROBLEM_RESPONSES
from claimforge_api.auth.deps import CurrentUser
from claimforge_api.estimates import service
from claimforge_api.estimates.schemas import (
    EstimateCreate,
    EstimateRead,
    EstimateStatusChange,
    EstimateSummary,
    EstimateUpdate,
    LineCreate,
    LineUpdate,
)

router = APIRouter(
    prefix="/organizations/{organization_id}/claims/{claim_id}/estimates",
    tags=["estimates"],
    responses=PROBLEM_RESPONSES,
)


@router.get("", summary="List a claim's estimates", description="By number.")
async def list_estimates(
    organization_id: UUID, claim_id: UUID, session: DbSession, user: CurrentUser
) -> list[EstimateSummary]:
    found = await service.list_estimates(session, organization_id, claim_id, user=user)
    return [EstimateSummary.model_validate(e) for e in found]


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Start an estimate",
    description="Needs `estimates:write`. Numbered on the claim; priced from the "
    "organization's default list unless `price_list_id` says otherwise. Closed and "
    "cancelled claims are read-only (`claim_locked`).",
)
async def create_estimate(
    organization_id: UUID,
    claim_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: EstimateCreate,
) -> EstimateRead:
    estimate = await service.create_estimate(session, organization_id, claim_id, body, user=user)
    return service.present(estimate)


@router.get("/{estimate_id}", summary="Get an estimate, with its lines")
async def get_estimate(
    organization_id: UUID, claim_id: UUID, estimate_id: UUID, session: DbSession, user: CurrentUser
) -> EstimateRead:
    estimate = await service.get_estimate(
        session, organization_id, claim_id, estimate_id, user=user
    )
    return service.present(estimate)


@router.patch(
    "/{estimate_id}",
    summary="Edit a draft estimate",
    description="Drafts only (`estimate_not_draft`). A new price list prices new lines; "
    "existing lines keep their prices.",
)
async def update_estimate(
    organization_id: UUID,
    claim_id: UUID,
    estimate_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: EstimateUpdate,
) -> EstimateRead:
    estimate = await service.update_estimate(
        session, organization_id, claim_id, estimate_id, body, user=user
    )
    return service.present(estimate)


@router.post(
    "/{estimate_id}/status",
    summary="Move an estimate along its workflow",
    description="draft → submitted (needs a line) → approved or rejected; submitted or "
    "rejected → draft to change it; approved → draft to reopen. Submitting, withdrawing "
    "and reworking need `estimates:write`; approving, rejecting and reopening need "
    "`estimates:approve`. Other moves: `estimate_transition`, with `allowed`.",
)
async def change_estimate_status(
    organization_id: UUID,
    claim_id: UUID,
    estimate_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: EstimateStatusChange,
) -> EstimateRead:
    estimate = await service.change_status(
        session, organization_id, claim_id, estimate_id, body.status, user=user
    )
    return service.present(estimate)


@router.delete(
    "/{estimate_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a draft estimate",
    description="Drafts only: what went to a carrier stays on record.",
)
async def delete_estimate(
    organization_id: UUID, claim_id: UUID, estimate_id: UUID, session: DbSession, user: CurrentUser
) -> None:
    await service.delete_estimate(session, organization_id, claim_id, estimate_id, user=user)


@router.post(
    "/{estimate_id}/lines",
    status_code=status.HTTP_201_CREATED,
    summary="Add a line",
    description="From a price item (`price_item_id`: its code, description, unit and price "
    "are copied) or by hand (`description`, `unit`, `unit_price`). `position` inserts it "
    "there; by default it goes last. Answers with the whole estimate.",
)
async def add_estimate_line(
    organization_id: UUID,
    claim_id: UUID,
    estimate_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: LineCreate,
) -> EstimateRead:
    estimate = await service.add_line(
        session, organization_id, claim_id, estimate_id, body, user=user
    )
    return service.present(estimate)


@router.patch(
    "/{estimate_id}/lines/{line_id}",
    summary="Edit a line",
    description="Only the fields sent change; `position` moves it. Answers with the whole "
    "estimate.",
)
async def update_estimate_line(
    organization_id: UUID,
    claim_id: UUID,
    estimate_id: UUID,
    line_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: LineUpdate,
) -> EstimateRead:
    estimate = await service.update_line(
        session, organization_id, claim_id, estimate_id, line_id, body, user=user
    )
    return service.present(estimate)


@router.delete(
    "/{estimate_id}/lines/{line_id}",
    summary="Delete a line",
    description="Later lines move up. Answers with the whole estimate.",
)
async def delete_estimate_line(
    organization_id: UUID,
    claim_id: UUID,
    estimate_id: UUID,
    line_id: UUID,
    session: DbSession,
    user: CurrentUser,
) -> EstimateRead:
    estimate = await service.delete_line(
        session, organization_id, claim_id, estimate_id, line_id, user=user
    )
    return service.present(estimate)
