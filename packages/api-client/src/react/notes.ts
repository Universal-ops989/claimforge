/**
 * Notes on claims, and the notes that mention the signed-in user.
 *
 * Both lists are newest first, so a new note goes on top of the first loaded page and
 * edits and deletes change the loaded pages in place; loading more still continues from
 * each page's cursor. Nothing here is optimistic: the API turns `<@user-id>` mentions in
 * `body` into names in `text`, which only the answer has.
 */
import {
  infiniteQueryOptions,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";

import type { ApiClient } from "../client";
import type { CursorPage, QueryParams, RequestBody, Schema } from "../index";
import { useApi } from "./context";
import { queryKeys } from "./keys";
import { editPages, nextCursor } from "./pages";

type Note = Schema<"NoteRead">;
type NotePages = InfiniteData<CursorPage<Note>>;

const NOTES = "/v1/organizations/{organization_id}/claims/{claim_id}/notes";
const NOTE = `${NOTES}/{note_id}` as const;
const MENTIONS = "/v1/organizations/{organization_id}/notes/mentioning-me";

type NotesQuery = Omit<QueryParams<typeof NOTES, "get">, "cursor">;
type MentionsQuery = Omit<QueryParams<typeof MENTIONS, "get">, "cursor">;

// ─── Reading ─────────────────────────────────────────────────────────────────

/** A claim's notes, newest first. */
export function notesQuery(
  api: ApiClient,
  organizationId: string,
  claimId: string,
  query: NotesQuery = {},
) {
  return infiniteQueryOptions({
    queryKey: queryKeys.noteList(organizationId, claimId, query),
    queryFn: ({ pageParam, signal }) =>
      api.get(NOTES, {
        path: { organization_id: organizationId, claim_id: claimId },
        query: { ...query, cursor: pageParam },
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
  });
}

export function useNotes(organizationId: string, claimId: string, query: NotesQuery = {}) {
  return useInfiniteQuery(notesQuery(useApi(), organizationId, claimId, query));
}

/** Notes on live claims that mention the signed-in user, newest first. */
export function mentionsQuery(api: ApiClient, organizationId: string, query: MentionsQuery = {}) {
  return infiniteQueryOptions({
    queryKey: queryKeys.mentionList(organizationId, query),
    queryFn: ({ pageParam, signal }) =>
      api.get(MENTIONS, {
        path: { organization_id: organizationId },
        query: { ...query, cursor: pageParam },
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
  });
}

export function useNotesMentioningMe(organizationId: string, query: MentionsQuery = {}) {
  return useInfiniteQuery(mentionsQuery(useApi(), organizationId, query));
}

// ─── Cache upkeep ────────────────────────────────────────────────────────────

/** Apply `edit` to the loaded pages of the claim's notes and of the mentions list. */
function editNotes(
  queryClient: QueryClient,
  organizationId: string,
  claimId: string,
  edit: (notes: Note[]) => Note[],
): void {
  for (const queryKey of [
    queryKeys.notes(organizationId, claimId),
    queryKeys.mentions(organizationId),
  ]) {
    queryClient.setQueriesData<NotePages>({ queryKey }, (pages) => editPages(pages, edit));
  }
}

/**
 * Refetch what a note change can reach beyond the loaded pages: the timeline gained an
 * entry, and whether a note mentions the user may have changed.
 */
async function refresh(
  queryClient: QueryClient,
  organizationId: string,
  claimId: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.timelines(organizationId, claimId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.mentions(organizationId) }),
  ]);
}

// ─── Changing ────────────────────────────────────────────────────────────────

/** Write a note; mention members with `<@user-id>` in `body`. */
export function useCreateNote(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RequestBody<typeof NOTES, "post">) =>
      api.post(NOTES, { path: { organization_id: organizationId, claim_id: claimId }, body }),
    onSuccess: async (created) => {
      queryClient.setQueriesData<NotePages>(
        { queryKey: queryKeys.notes(organizationId, claimId) },
        (pages) =>
          editPages(pages, (notes, index) =>
            index === 0 ? [created, ...notes.filter((note) => note.id !== created.id)] : notes,
          ),
      );
      await refresh(queryClient, organizationId, claimId);
    },
  });
}

export interface NoteChange {
  noteId: string;
  body: string;
}

/** Rewrite a note; only its author may (403 `not_note_author`). */
export function useUpdateNote(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, body }: NoteChange) =>
      api.patch(NOTE, {
        path: { organization_id: organizationId, claim_id: claimId, note_id: noteId },
        body: { body },
      }),
    onSuccess: async (updated) => {
      editNotes(queryClient, organizationId, claimId, (notes) =>
        notes.map((note) => (note.id === updated.id ? updated : note)),
      );
      await refresh(queryClient, organizationId, claimId);
    },
  });
}

/** Delete a note; its author or an admin may. */
export function useDeleteNote(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) =>
      api.delete(NOTE, {
        path: { organization_id: organizationId, claim_id: claimId, note_id: noteId },
      }),
    onSuccess: async (_, noteId) => {
      editNotes(queryClient, organizationId, claimId, (notes) =>
        notes.filter((note) => note.id !== noteId),
      );
      await refresh(queryClient, organizationId, claimId);
    },
  });
}
