"""HTTP endpoints for the organization's report templates."""

from uuid import UUID

from fastapi import APIRouter, status

from claimforge_api.api.deps import DbSession
from claimforge_api.api.problems import PROBLEM_RESPONSES
from claimforge_api.auth.deps import CurrentUser
from claimforge_api.reports import service
from claimforge_api.reports.models import ReportKind
from claimforge_api.reports.schemas import TemplateCreate, TemplateRead, TemplateUpdate

router = APIRouter(
    prefix="/organizations/{organization_id}/report-templates",
    tags=["reports"],
    responses=PROBLEM_RESPONSES,
)


@router.get("", summary="List report templates", description="By kind, each kind's default first.")
async def list_report_templates(
    organization_id: UUID,
    session: DbSession,
    user: CurrentUser,
    kind: ReportKind | None = None,
) -> list[TemplateRead]:
    found = await service.list_templates(session, organization_id, kind, user=user)
    return [service.present(t) for t in found]


@router.get(
    "/effective",
    summary="The template a kind of report uses",
    description="The kind's default template, or the built-in one (`built_in: true`) when "
    "none is set up.",
)
async def get_effective_report_template(
    organization_id: UUID, kind: ReportKind, session: DbSession, user: CurrentUser
) -> TemplateRead:
    return await service.effective_template(session, organization_id, kind, user=user)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create a report template",
    description="Needs `reports:generate`. Names are unique in the organization, ignoring "
    "case (`template_name_taken`); `options` are checked against the kind.",
)
async def create_report_template(
    organization_id: UUID, session: DbSession, user: CurrentUser, body: TemplateCreate
) -> TemplateRead:
    template = await service.create_template(session, organization_id, body, user=user)
    return service.present(template)


@router.get("/{template_id}", summary="Get a report template")
async def get_report_template(
    organization_id: UUID, template_id: UUID, session: DbSession, user: CurrentUser
) -> TemplateRead:
    template = await service.get_template(session, organization_id, template_id, user=user)
    return service.present(template)


@router.patch(
    "/{template_id}",
    summary="Edit a report template",
    description="Only the fields sent change; `options` replaces them all (left-out options "
    "go back to their defaults). The kind is fixed.",
)
async def update_report_template(
    organization_id: UUID,
    template_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: TemplateUpdate,
) -> TemplateRead:
    template = await service.update_template(session, organization_id, template_id, body, user=user)
    return service.present(template)


@router.delete(
    "/{template_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a report template"
)
async def delete_report_template(
    organization_id: UUID, template_id: UUID, session: DbSession, user: CurrentUser
) -> None:
    await service.delete_template(session, organization_id, template_id, user=user)
