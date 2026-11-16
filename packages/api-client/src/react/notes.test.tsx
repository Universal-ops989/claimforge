// @vitest-environment jsdom
import { act, cleanup, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import type { Schema } from "../index";
import {
  allItems,
  useCreateNote,
  useDeleteNote,
  useNotes,
  useNotesMentioningMe,
  useUpdateNote,
} from "./index";
import {
  CLAIM_ID,
  CLAIM_NUMBER,
  FakeServer,
  json,
  MORGAN,
  noContent,
  ORG_ID,
  problem,
  renderWithApi,
  RILEY,
} from "./testing";

afterEach(cleanup);

const NOTES = `/v1/organizations/${ORG_ID}/claims/${CLAIM_ID}/notes`;
const MENTIONS = `/v1/organizations/${ORG_ID}/notes/mentioning-me`;

function note(n: number, text: string): Schema<"NoteRead"> {
  return {
    id: `0198a2c4-7b1e-7cc0-8000-00000000040${String(n)}`,
    claim: { id: CLAIM_ID, number: CLAIM_NUMBER },
    author: RILEY,
    body: text.replace("@Morgan Member", `<@${MORGAN.id}>`),
    text,
    mentions: text.includes("@Morgan Member") ? [MORGAN] : [],
    edited_at: null,
    created_at: "2026-11-16T12:00:00Z",
    updated_at: "2026-11-16T12:00:00Z",
  };
}

const page = (items: Schema<"NoteRead">[], next: string | null) => ({
  items,
  next_cursor: next,
  has_more: next !== null,
});

const texts = (notes: Schema<"NoteRead">[]) => notes.map((n) => n.text);

/**
 * Two pages of claim notes (newest first) and one page of mentions. Only the first load
 * of each list is answered: refetches hang, so what the tests see is the cache edit.
 */
function noteServer() {
  const served = new Set<string>();
  const once = (key: string, body: unknown) => {
    if (served.has(key)) {
      return new Promise<Response>(() => undefined);
    }
    served.add(key);
    return json(body);
  };
  return new FakeServer()
    .on("GET", NOTES, (request) =>
      new URL(request.url).searchParams.has("cursor")
        ? once("notes-2", page([note(1, "Moisture mapped")], null))
        : once("notes-1", page([note(3, "Dryers set, @Morgan Member to check")], "c1")),
    )
    .on("GET", MENTIONS, () =>
      once("mentions", page([note(3, "Dryers set, @Morgan Member to check")], null)),
    );
}

async function withNotes<Mutation>(server: FakeServer, useMutation: () => Mutation) {
  const rendered = renderWithApi(
    () => ({
      notes: useNotes(ORG_ID, CLAIM_ID),
      mine: useNotesMentioningMe(ORG_ID),
      change: useMutation(),
    }),
    { server },
  );
  // Read `data`, not just a status: hooks re-render only for what was read.
  await waitFor(() => {
    const { notes, mine } = rendered.result.current;
    expect(notes.data && mine.data).toBeDefined();
  });
  return rendered;
}

test("a new note goes on top of the first page only", async () => {
  const server = noteServer().on("POST", NOTES, () => json(note(4, "Adjuster on site"), 201));
  const { result } = await withNotes(server, () => useCreateNote(ORG_ID, CLAIM_ID));
  await act(() => result.current.notes.fetchNextPage());
  await waitFor(() => {
    expect(result.current.notes.data?.pages).toHaveLength(2);
  });

  act(() => {
    result.current.change.mutate({ body: "Adjuster on site" });
  });

  await waitFor(() => {
    expect(texts(allItems(result.current.notes.data))).toEqual([
      "Adjuster on site",
      "Dryers set, @Morgan Member to check",
      "Moisture mapped",
    ]);
  });
  // The mentions list is refetched (a new note may mention the user), not edited.
  expect(texts(allItems(result.current.mine.data))).toEqual([
    "Dryers set, @Morgan Member to check",
  ]);
});

describe("an existing note", () => {
  test("an edit shows in the claim's notes and in mentions", async () => {
    const edited = {
      ...note(3, "Four dryers set, @Morgan Member to check"),
      edited_at: "2026-11-16T13:00:00Z",
    };
    const server = noteServer().on("PATCH", `${NOTES}/${edited.id}`, () => json(edited));
    const { result } = await withNotes(server, () => useUpdateNote(ORG_ID, CLAIM_ID));

    act(() => {
      result.current.change.mutate({ noteId: edited.id, body: edited.body });
    });

    await waitFor(() => {
      expect(texts(allItems(result.current.notes.data))).toEqual([edited.text]);
    });
    expect(allItems(result.current.mine.data)[0]?.edited_at).toBe(edited.edited_at);
  });

  test("a deleted note leaves both lists", async () => {
    const gone = note(3, "Dryers set, @Morgan Member to check");
    const server = noteServer().on("DELETE", `${NOTES}/${gone.id}`, noContent);
    const { result } = await withNotes(server, () => useDeleteNote(ORG_ID, CLAIM_ID));

    act(() => {
      result.current.change.mutate(gone.id);
    });

    await waitFor(() => {
      expect(allItems(result.current.notes.data)).toEqual([]);
    });
    expect(allItems(result.current.mine.data)).toEqual([]);
  });

  test("a note someone else wrote can't be edited, and stays as it was", async () => {
    const theirs = note(3, "Dryers set, @Morgan Member to check");
    const server = noteServer().on("PATCH", `${NOTES}/${theirs.id}`, () =>
      problem(403, "not_note_author"),
    );
    const { result } = await withNotes(server, () => useUpdateNote(ORG_ID, CLAIM_ID));

    await act(async () => {
      await result.current.change
        .mutateAsync({ noteId: theirs.id, body: "Rewritten" })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.change.error).toMatchObject({ code: "not_note_author" });
    });
    expect(texts(allItems(result.current.notes.data))).toEqual([theirs.text]);
  });
});
