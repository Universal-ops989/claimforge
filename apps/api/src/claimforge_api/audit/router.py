"""Read an organization's audit timeline."""

from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import select

from claimforge_api.api.deps import DbSession, PageParamsDep
from claimforge_api.api.problems import PROBLEM_RESPONSES
from claimforge_api.audit.models import AuditEvent
from claimforge_api.auth.deps import CurrentUser
from claimforge_api.auth.permissions import Permission, authorize
from claimforge_api.db.pagination import CursorPage, SortKey, paginate
from claimforge_api.users.models import User

router = APIRouter(
    prefix="/organizations/{organization_id}/audit-events",
    tags=["audit"],
    responses=PROBLEM_RESPONSES,
)

NEWEST_FIRST = SortKey([AuditEvent.id], direction="desc")


class AuditActor(BaseModel):
    id: UUID
    full_name: str


class AuditEventRead(BaseModel):
    id: UUID
    action: str
    entity_type: str
    entity_id: UUID
    actor: AuditActor | None
    changes: dict[str, Any]
    request_id: str | None
    created_at: datetime


@router.get("", summary="Audit timeline for an organization")
async def list_audit_events(
    organization_id: UUID,
    user: CurrentUser,
    session: DbSession,
    page: PageParamsDep,
    entity_type: Annotated[str | None, Query(max_length=50)] = None,
    entity_id: UUID | None = None,
    actor_user_id: UUID | None = None,
) -> CursorPage[AuditEventRead]:
    await authorize(session, user, organization_id, Permission.AUDIT_READ)

    statement = select(AuditEvent).where(AuditEvent.organization_id == organization_id)
    if entity_type is not None:
        statement = statement.where(AuditEvent.entity_type == entity_type)
    if entity_id is not None:
        statement = statement.where(AuditEvent.entity_id == entity_id)
    if actor_user_id is not None:
        statement = statement.where(AuditEvent.actor_user_id == actor_user_id)

    result = await paginate(session, statement, NEWEST_FIRST, limit=page.limit, cursor=page.cursor)

    actor_ids = {e.actor_user_id for e in result.items if e.actor_user_id is not None}
    names: dict[UUID, str] = {}
    if actor_ids:
        rows = await session.execute(select(User.id, User.full_name).where(User.id.in_(actor_ids)))
        names = {actor_id: full_name for actor_id, full_name in rows}
    return CursorPage[AuditEventRead](
        items=[
            AuditEventRead(
                id=e.id,
                action=e.action,
                entity_type=e.entity_type,
                entity_id=e.entity_id,
                actor=(
                    AuditActor(id=e.actor_user_id, full_name=names[e.actor_user_id])
                    if e.actor_user_id in names
                    else None
                ),
                changes=e.changes,
                request_id=e.request_id,
                created_at=e.created_at,
            )
            for e in result.items
        ],
        next_cursor=result.next_cursor,
        has_more=result.has_more,
    )
