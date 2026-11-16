"""HTTP endpoints for the organization's report templates."""

from uuid import UUID

from fastapi import APIRouter, Request, status

from claimforge_api.api.deps import DbSession, StorageDep
from claimforge_api.api.problems import PROBLEM_RESPONSES
from claimforge_api.auth.deps import CurrentUser
from claimforge_api.reports import logos, service
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
    storage: StorageDep,
    user: CurrentUser,
    kind: ReportKind | None = None,
) -> list[TemplateRead]:
    found = await service.list_templates(session, organization_id, kind, user=user)
    return [await service.present(storage, t) for t in found]


@router.get(
    "/effective",
    summary="The template a kind of report uses",
    description="The kind's default template, or the built-in one (`built_in: true`) when "
    "none is set up.",
)
async def get_effective_report_template(
    organization_id: UUID,
    kind: ReportKind,
    session: DbSession,
    storage: StorageDep,
    user: CurrentUser,
) -> TemplateRead:
    return await service.effective_template(session, storage, organization_id, kind, user=user)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create a report template",
    description="Needs `reports:generate`. Names are unique in the organization, ignoring "
    "case (`template_name_taken`); `options` are checked against the kind.",
)
async def create_report_template(
    organization_id: UUID,
    session: DbSession,
    storage: StorageDep,
    user: CurrentUser,
    body: TemplateCreate,
) -> TemplateRead:
    template = await service.create_template(session, organization_id, body, user=user)
    return await service.present(storage, template)


@router.get("/{template_id}", summary="Get a report template")
async def get_report_template(
    organization_id: UUID,
    template_id: UUID,
    session: DbSession,
    storage: StorageDep,
    user: CurrentUser,
) -> TemplateRead:
    template = await service.get_template(session, organization_id, template_id, user=user)
    return await service.present(storage, template)


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
    storage: StorageDep,
    user: CurrentUser,
    body: TemplateUpdate,
) -> TemplateRead:
    template = await service.update_template(session, organization_id, template_id, body, user=user)
    return await service.present(storage, template)


@router.delete(
    "/{template_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a report template"
)
async def delete_report_template(
    organization_id: UUID,
    template_id: UUID,
    session: DbSession,
    storage: StorageDep,
    user: CurrentUser,
) -> None:
    await service.delete_template(session, storage, organization_id, template_id, user=user)


async def _read_capped(request: Request) -> bytes:
    declared = request.headers.get("content-length")
    if declared is not None and declared.isdigit() and int(declared) > logos.MAX_BYTES:
        raise logos.LogoInvalidError("Logos can be at most 2 MB", limit=logos.MAX_BYTES)
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > logos.MAX_BYTES:
            raise logos.LogoInvalidError("Logos can be at most 2 MB", limit=logos.MAX_BYTES)
    return bytes(body)


@router.put(
    "/{template_id}/logo",
    summary="Set a template's logo",
    description="Needs `reports:generate`. Send the image as the request body: PNG, JPEG or "
    "WebP, up to 2 MB. It's shrunk to fit 1200 by 600 pixels and stored as PNG; anything that "
    "isn't a readable image is refused (`logo_invalid`). Replaces any earlier logo.",
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "image/png": {"schema": {"type": "string", "format": "binary"}},
                "image/jpeg": {"schema": {"type": "string", "format": "binary"}},
                "image/webp": {"schema": {"type": "string", "format": "binary"}},
            },
        }
    },
)
async def set_report_template_logo(
    organization_id: UUID,
    template_id: UUID,
    request: Request,
    session: DbSession,
    storage: StorageDep,
    user: CurrentUser,
) -> TemplateRead:
    data = await _read_capped(request)
    template = await service.set_logo(
        session, storage, organization_id, template_id, data, user=user
    )
    return await service.present(storage, template)


@router.delete("/{template_id}/logo", summary="Remove a template's logo")
async def remove_report_template_logo(
    organization_id: UUID,
    template_id: UUID,
    session: DbSession,
    storage: StorageDep,
    user: CurrentUser,
) -> TemplateRead:
    template = await service.remove_logo(session, storage, organization_id, template_id, user=user)
    return await service.present(storage, template)
