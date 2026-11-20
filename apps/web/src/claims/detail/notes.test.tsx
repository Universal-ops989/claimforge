import { ids, people } from "@claimforge/api-client/fixtures";
import { mockApi, problem } from "@claimforge/api-client/msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { API_URL, backend, renderApp, server } from "../../test/render";

const mock = mockApi(API_URL);
const NOTES = "/lone-star/claims/2026-00042/notes";

type User = ReturnType<typeof userEvent.setup>;

const open = (as: "morgan@example.com" | "riley@example.com" = "morgan@example.com") =>
  renderApp(NOTES, { signedInAs: as });
const list = async () => within(await screen.findByRole("list", { name: "Notes" }));
const composer = async () => within(await screen.findByRole("form", { name: "New note" }));

describe("the notes", () => {
  test("show newest first, with the author, and mentions marked", async () => {
    await open();

    const note = (await list()).getByRole("listitem");
    expect(note).toHaveTextContent("Riley Tech");
    expect(note).toHaveTextContent("Dryers set, @Morgan Member to check tomorrow");
    expect(within(note).getByText("@Morgan Member")).toBeInTheDocument();
  });

  test("none yet says what they're for", async () => {
    backend.db.notes = [];
    await open();

    expect(await screen.findByText("No notes yet")).toBeInTheDocument();
  });
});

describe("writing a note", () => {
  async function typeIn(user: User, text: string) {
    const field = (await composer()).getByRole("textbox", { name: "New note" });
    await user.click(field);
    await user.type(field, text);
    return field;
  }

  test("@ offers teammates, and the note goes with a mention of the one chosen", async () => {
    const user = userEvent.setup();
    await open();

    const field = await typeIn(user, "Fans moved, @ri");
    await user.click(await screen.findByRole("button", { name: "Mention Riley Tech" }));
    expect(field).toHaveValue("Fans moved, @Riley Tech ");
    // Typing on at once lands after the name: focus is back in the box.
    expect(field).toHaveFocus();
    await user.keyboard("please check");
    await user.click(screen.getByRole("button", { name: "Add note" }));

    const newest = (await list()).getAllByRole("listitem")[0];
    await waitFor(() => {
      expect(newest).toHaveTextContent("Fans moved, @Riley Tech please check");
    });
    expect(backend.db.notes.at(-1)?.body).toBe(`Fans moved, <@${people.riley.id}> please check`);
    expect(field).toHaveValue("");
  });

  test("an empty note isn't sent", async () => {
    const user = userEvent.setup();
    await open();

    await user.click((await composer()).getByRole("button", { name: "Add note" }));

    expect(await screen.findByText("Write something first.")).toBeInTheDocument();
    expect(backend.db.notes).toHaveLength(1);
  });

  test("a refusal is told in words, and the text is kept", async () => {
    server.use(
      mock.post("/v1/organizations/{organization_id}/claims/{claim_id}/notes", () =>
        problem(422, "unknown_mention"),
      ),
    );
    const user = userEvent.setup();
    await open();

    const field = await typeIn(user, "Hello");
    await user.click(screen.getByRole("button", { name: "Add note" }));

    expect(
      await screen.findByText("Someone mentioned isn't a member of this organization."),
    ).toBeInTheDocument();
    expect(field).toHaveValue("Hello");
  });
});

describe("changing a note", () => {
  test("its author edits it, mentions kept, and it says it was edited", async () => {
    const user = userEvent.setup();
    await open("riley@example.com");

    const note = within((await list()).getByRole("listitem"));
    await user.click(note.getByRole("button", { name: "Edit" }));
    const field = note.getByRole("textbox", { name: "Edit note" });
    expect(field).toHaveValue("Dryers set, @Morgan Member to check tomorrow");
    await user.clear(field);
    await user.type(field, "Dryers set, @Morgan Member to check Friday");
    await user.click(note.getByRole("button", { name: "Save" }));

    expect(await note.findByText(/edited/)).toBeInTheDocument();
    expect(backend.db.notes[0]?.body).toBe(`Dryers set, <@${people.morgan.id}> to check Friday`);
  });

  test("someone else's note can't be edited, but an admin can delete it, asking first", async () => {
    const user = userEvent.setup();
    await open();

    const note = within((await list()).getByRole("listitem"));
    expect(note.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    await user.click(note.getByRole("button", { name: "Delete" }));
    const confirm = within(await screen.findByRole("alertdialog", { name: "Delete this note?" }));
    expect(confirm.getByText(/Riley Tech wrote it/)).toBeInTheDocument();
    await user.click(confirm.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("No notes yet")).toBeInTheDocument();
  });

  test("on a closed claim notes can only be read", async () => {
    const claim = backend.db.claims.find((c) => c.claim.id === ids.claim);
    if (claim) claim.claim.status = "closed";
    await open("riley@example.com");

    const note = within((await list()).getByRole("listitem"));
    expect(note.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "New note" })).not.toBeInTheDocument();
  });
});
