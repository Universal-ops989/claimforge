"""Keeping the organization's report templates.

Reading needs ``org:read``; changes need ``reports:generate``.
"""

import logging
from datetime import timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from claimforge_api.auth.permissions import Permission, authorize
from claimforge_api.core.errors import ConflictError, NotFoundError
from claimforge_api.reports import logos
from claimforge_api.reports.models import DEFAULT_ACCENT, ReportKind, ReportTemplate
from claimforge_api.reports.schemas import (
    OPTIONS,
    TITLES,
    TemplateCreate,
    TemplateRead,
    TemplateUpdate,
    options_for,
)
from claimforge_api.storage.base import ObjectStorage, StorageUnavailableError
from claimforge_api.users.models import User

logger = logging.getLogger(__name__)

#: How long a logo link works.
LINK_LIFETIME = timedelta(hours=1)


class TemplateNameTakenError(ConflictError):
    code = "template_name_taken"
    title = "A template already has this name"


async def present(storage: ObjectStorage, template: ReportTemplate) -> TemplateRead:
    kind = ReportKind(template.kind)
    logo_url = None
    if template.logo_key is not None:
        logo_url = await storage.download_url(template.logo_key, expires_in=LINK_LIFETIME)
    return TemplateRead(
        id=template.id,
        kind=kind,
        name=template.name,
        title=template.title or TITLES[kind],
        header_text=template.header_text,
        footer_text=template.footer_text,
        accent_color=template.accent_color,
        options=OPTIONS[kind].model_validate(template.options),
        is_default=template.is_default,
        logo_url=logo_url,
        built_in=False,
        created_at=template.created_at,
        updated_at=template.updated_at,
    )


def built_in(kind: ReportKind) -> TemplateRead:
    """What a kind's reports look like before anyone sets up a template."""
    return TemplateRead(
        id=None,
        kind=kind,
        name="Built-in",
        title=TITLES[kind],
        header_text=None,
        footer_text=None,
        accent_color=DEFAULT_ACCENT,
        options=OPTIONS[kind](),
        is_default=True,
        logo_url=None,
        built_in=True,
        created_at=None,
        updated_at=None,
    )


async def _get(session: AsyncSession, organization_id: UUID, template_id: UUID) -> ReportTemplate:
    template = await session.scalar(
        select(ReportTemplate)
        .where(ReportTemplate.id == template_id, ReportTemplate.organization_id == organization_id)
        .execution_options(populate_existing=True)
    )
    if template is None:
        raise NotFoundError("Report template not found", template_id=str(template_id))
    return template


async def _check_name(
    session: AsyncSession, organization_id: UUID, name: str, *, ignore: UUID | None = None
) -> None:
    statement = select(ReportTemplate.id).where(
        ReportTemplate.organization_id == organization_id,
        func.lower(ReportTemplate.name) == name.lower(),
    )
    if ignore is not None:
        statement = statement.where(ReportTemplate.id != ignore)
    if await session.scalar(statement) is not None:
        raise TemplateNameTakenError(f"There's already a template called {name}", name=name)


async def _step_down_default(
    session: AsyncSession, organization_id: UUID, kind: ReportKind, *, keep: UUID | None = None
) -> None:
    current = await session.scalar(
        select(ReportTemplate).where(
            ReportTemplate.organization_id == organization_id,
            ReportTemplate.kind == kind,
            ReportTemplate.is_default.is_(True),
        )
    )
    if current is not None and current.id != keep:
        current.is_default = False
        # Flushed now: the one-default index must never see two at once.
        await session.flush()


async def list_templates(
    session: AsyncSession, organization_id: UUID, kind: ReportKind | None, *, user: User
) -> list[ReportTemplate]:
    """By kind, the default first, then by name."""
    await authorize(session, user, organization_id, Permission.ORG_READ)
    statement = select(ReportTemplate).where(ReportTemplate.organization_id == organization_id)
    if kind is not None:
        statement = statement.where(ReportTemplate.kind == kind)
    return list(
        await session.scalars(
            statement.order_by(
                ReportTemplate.kind,
                ReportTemplate.is_default.desc(),
                func.lower(ReportTemplate.name),
            )
        )
    )


async def get_template(
    session: AsyncSession, organization_id: UUID, template_id: UUID, *, user: User
) -> ReportTemplate:
    await authorize(session, user, organization_id, Permission.ORG_READ)
    return await _get(session, organization_id, template_id)


async def effective_template(
    session: AsyncSession,
    storage: ObjectStorage,
    organization_id: UUID,
    kind: ReportKind,
    *,
    user: User,
) -> TemplateRead:
    """What a report of ``kind`` uses: the kind's default, or the built-in one."""
    await authorize(session, user, organization_id, Permission.ORG_READ)
    default = await session.scalar(
        select(ReportTemplate).where(
            ReportTemplate.organization_id == organization_id,
            ReportTemplate.kind == kind,
            ReportTemplate.is_default.is_(True),
        )
    )
    return await present(storage, default) if default is not None else built_in(kind)


async def create_template(
    session: AsyncSession, organization_id: UUID, data: TemplateCreate, *, user: User
) -> ReportTemplate:
    await authorize(session, user, organization_id, Permission.REPORTS_GENERATE)
    await _check_name(session, organization_id, data.name)
    if data.is_default:
        await _step_down_default(session, organization_id, data.kind)
    template = ReportTemplate(organization_id=organization_id, **data.model_dump())
    session.add(template)
    await session.commit()
    return await _get(session, organization_id, template.id)


async def update_template(
    session: AsyncSession,
    organization_id: UUID,
    template_id: UUID,
    data: TemplateUpdate,
    *,
    user: User,
) -> ReportTemplate:
    await authorize(session, user, organization_id, Permission.REPORTS_GENERATE)
    template = await _get(session, organization_id, template_id)
    kind = ReportKind(template.kind)
    changes = data.model_dump(exclude_unset=True)
    name = changes.get("name")
    if name is not None and name.lower() != template.name.lower():
        await _check_name(session, organization_id, name, ignore=template.id)
    if "options" in changes:
        changes["options"] = options_for(kind, changes["options"])
    if changes.get("is_default"):
        await _step_down_default(session, organization_id, kind, keep=template.id)
    for field, value in changes.items():
        setattr(template, field, value)
    await session.commit()
    return await _get(session, organization_id, template_id)


async def delete_template(
    session: AsyncSession,
    storage: ObjectStorage,
    organization_id: UUID,
    template_id: UUID,
    *,
    user: User,
) -> None:
    await authorize(session, user, organization_id, Permission.REPORTS_GENERATE)
    template = await _get(session, organization_id, template_id)
    key = template.logo_key
    await session.delete(template)
    await session.commit()
    if key is not None:
        await _forget(storage, key)


async def _forget(storage: ObjectStorage, key: str) -> None:
    """Delete a logo file; if storage is down it's only wasted space, so say so and go on."""
    try:
        await storage.delete(key)
    except StorageUnavailableError:
        logger.warning("Logo file %s remains", key, exc_info=True)


async def set_logo(
    session: AsyncSession,
    storage: ObjectStorage,
    organization_id: UUID,
    template_id: UUID,
    data: bytes,
    *,
    user: User,
) -> ReportTemplate:
    """Store ``data`` as the template's logo, replacing any earlier one."""
    await authorize(session, user, organization_id, Permission.REPORTS_GENERATE)
    template = await _get(session, organization_id, template_id)
    png = logos.normalize(data)
    key = logos.logo_key(organization_id, template.id)
    await storage.put(key, png, content_type=logos.CONTENT_TYPE)
    # Same key each time, so a replaced logo leaves nothing behind. Recorded on the
    # template when it's new; a replacement only changes the file.
    template.logo_key = key
    await session.commit()
    return await _get(session, organization_id, template_id)


async def remove_logo(
    session: AsyncSession,
    storage: ObjectStorage,
    organization_id: UUID,
    template_id: UUID,
    *,
    user: User,
) -> ReportTemplate:
    await authorize(session, user, organization_id, Permission.REPORTS_GENERATE)
    template = await _get(session, organization_id, template_id)
    key = template.logo_key
    template.logo_key = None
    await session.commit()
    if key is not None:
        await _forget(storage, key)
    return await _get(session, organization_id, template_id)
