"""HTTP endpoints for claim notes and the notes that mention you."""

from uuid import UUID

from fastapi import APIRouter, status

from claimforge_api.api.deps import DbSession, PageParamsDep
from claimforge_api.api.problems import PROBLEM_RESPONSES
from claimforge_api.auth.deps import CurrentUser
from claimforge_api.db.pagination import CursorPage, Page
from claimforge_api.notes import service
from claimforge_api.notes.models import Note
from claimforge_api.notes.schemas import NoteCreate, NoteRead, NoteUpdate

router = APIRouter(
    prefix="/organizations/{organization_id}",
    tags=["notes"],
    responses=PROBLEM_RESPONSES,
)


def _page(result: Page[Note]) -> CursorPage[NoteRead]:
    return CursorPage[NoteRead](
        items=[NoteRead.model_validate(n) for n in result.items],
        next_cursor=result.next_cursor,
        has_more=result.has_more,
    )


@router.get("/claims/{claim_id}/notes", summary="List a claim's notes", description="Newest first.")
async def list_notes(
    organization_id: UUID,
    claim_id: UUID,
    session: DbSession,
    user: CurrentUser,
    page: PageParamsDep,
) -> CursorPage[NoteRead]:
    result = await service.list_notes(
        session, organization_id, claim_id, user=user, limit=page.limit, cursor=page.cursor
    )
    return _page(result)


@router.post(
    "/claims/{claim_id}/notes",
    status_code=status.HTTP_201_CREATED,
    summary="Write a note",
    description="Needs `field_data:write`. Mention members with `<@user-id>` tokens; anyone "
    "who isn't a member makes the request fail (`unknown_mention`). Closed and cancelled "
    "claims are read-only (`claim_locked`).",
)
async def create_note(
    organization_id: UUID,
    claim_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: NoteCreate,
) -> NoteRead:
    note = await service.create_note(session, organization_id, claim_id, body, user=user)
    return NoteRead.model_validate(note)


@router.patch(
    "/claims/{claim_id}/notes/{note_id}",
    summary="Edit a note",
    description="Only the author can edit a note (`not_note_author`). Mentions are re-read "
    "from the new body and `edited_at` is set; sending the same text changes nothing.",
)
async def update_note(
    organization_id: UUID,
    claim_id: UUID,
    note_id: UUID,
    session: DbSession,
    user: CurrentUser,
    body: NoteUpdate,
) -> NoteRead:
    note = await service.update_note(session, organization_id, claim_id, note_id, body, user=user)
    return NoteRead.model_validate(note)


@router.delete(
    "/claims/{claim_id}/notes/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a note",
    description="The author or an admin (`claims:delete`) can delete a note.",
)
async def delete_note(
    organization_id: UUID, claim_id: UUID, note_id: UUID, session: DbSession, user: CurrentUser
) -> None:
    await service.delete_note(session, organization_id, claim_id, note_id, user=user)


@router.get(
    "/notes/mentioning-me",
    summary="Notes that mention me",
    description="Notes on the organization's claims that mention the signed-in member, "
    "newest first. Each note carries its claim's id and number.",
)
async def notes_mentioning_me(
    organization_id: UUID, session: DbSession, user: CurrentUser, page: PageParamsDep
) -> CursorPage[NoteRead]:
    result = await service.notes_mentioning(
        session, organization_id, user=user, limit=page.limit, cursor=page.cursor
    )
    return _page(result)
