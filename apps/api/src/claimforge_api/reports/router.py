"""HTTP endpoints for the organization's report templates."""

from uuid import UUID

from fastapi import APIRouter, Request, Response, status

from claimforge_api.api.deps import DbSession, StorageDep
from claimforge_api.api.problems import PROBLEM_RESPONSES
from claimforge_api.auth.deps import CurrentUser
from claimforge_api.reports import jobs, logos, service
from claimforge_api.reports.models import JobStatus, ReportKind
from claimforge_api.reports.schemas import (
    ReportJobRead,
    ReportRequest,
    TemplateCreate,
    TemplateRead,
    TemplateUpdate,
)

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


claim_router = APIRouter(
    prefix="/organizations/{organization_id}/claims/{claim_id}/reports",
    tags=["reports"],
    responses=PROBLEM_RESPONSES,
)
#: Seconds a client should wait before asking about a queued report again.
POLL_SECONDS = "2"


@claim_router.post(
    "",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Request a report",
    description="Needs `reports:generate`. The report is made in the background, from the "
    "organization's default template for the kind (or the built-in one), with the "
    "requester's access. Follow `Location` to poll, waiting `Retry-After` seconds between "
    "requests. Closed claims can have reports.",
)
async def request_report(
    organization_id: UUID,
    claim_id: UUID,
    session: DbSession,
    storage: StorageDep,
    user: CurrentUser,
    body: ReportRequest,
    request: Request,
    response: Response,
) -> ReportJobRead:
    job = await jobs.request(session, organization_id, claim_id, body.kind, user=user)
    response.headers["Location"] = str(
        request.url_for(
            "get_report", organization_id=organization_id, claim_id=claim_id, job_id=job.id
        ).path
    )
    response.headers["Retry-After"] = POLL_SECONDS
    job = await jobs.get_job(session, organization_id, claim_id, job.id, user=user)
    return await jobs.present(session, storage, job)


@claim_router.get("", summary="List a claim's reports", description="Newest first.")
async def list_reports(
    organization_id: UUID,
    claim_id: UUID,
    session: DbSession,
    storage: StorageDep,
    user: CurrentUser,
) -> list[ReportJobRead]:
    found = await jobs.list_jobs(session, organization_id, claim_id, user=user)
    return [await jobs.present(session, storage, job) for job in found]


@claim_router.get(
    "/{job_id}",
    summary="Get a report",
    description="While it's `queued` the answer carries `Retry-After`. When `ready` it has a "
    "`download_url`; when `failed`, the reason in `error`.",
)
async def get_report(
    organization_id: UUID,
    claim_id: UUID,
    job_id: UUID,
    session: DbSession,
    storage: StorageDep,
    user: CurrentUser,
    response: Response,
) -> ReportJobRead:
    job = await jobs.get_job(session, organization_id, claim_id, job_id, user=user)
    if job.status == JobStatus.QUEUED:
        response.headers["Retry-After"] = POLL_SECONDS
    return await jobs.present(session, storage, job)


@claim_router.delete(
    "/{job_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a report",
    description="Needs `reports:generate`. Deletes the PDF too; a queued report won't be made.",
)
async def delete_report(
    organization_id: UUID,
    claim_id: UUID,
    job_id: UUID,
    session: DbSession,
    storage: StorageDep,
    user: CurrentUser,
) -> None:
    await jobs.delete_job(session, storage, organization_id, claim_id, job_id, user=user)
