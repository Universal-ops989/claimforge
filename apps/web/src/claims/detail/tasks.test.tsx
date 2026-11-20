import { ids, people } from "@claimforge/api-client/fixtures";
import { mockApi, problem } from "@claimforge/api-client/msw";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { API_URL, backend, renderApp, server } from "../../test/render";

const mock = mockApi(API_URL);
const TASKS = "/lone-star/claims/2026-00042/tasks";
const SEEDED = "Set dryers in the kitchen";

type User = ReturnType<typeof userEvent.setup>;

const open = (as: "morgan@example.com" | "riley@example.com" = "morgan@example.com") =>
  renderApp(TASKS, { signedInAs: as });
const column = async (name: "To do" | "Done") =>
  within(await screen.findByRole("region", { name: new RegExp(`^${name}`) }));

async function choose(user: User, field: RegExp, option: string) {
  await user.click(screen.getByRole("combobox", { name: field }));
  await user.click(await screen.findByRole("option", { name: option }));
}

describe("the board", () => {
  test("shows open tasks to do, with who and when, and what's overdue", async () => {
    await open();

    const toDo = await column("To do");
    const task = toDo.getByRole("listitem");
    expect(task).toHaveTextContent(SEEDED);
    expect(task).toHaveTextContent("Riley Tech");
    expect(task).toHaveTextContent("Due Nov 18, 2026");
    // The seeded task was due before today.
    expect(within(task).getByText("Overdue")).toBeInTheDocument();
    expect((await column("Done")).getByText("Nothing done yet.")).toBeInTheDocument();
  });

  test("ticking a task moves it to done at once, and back", async () => {
    const user = userEvent.setup();
    await open();

    await user.click((await column("To do")).getByRole("checkbox", { name: SEEDED }));

    expect(await (await column("Done")).findByRole("checkbox", { name: SEEDED })).toBeChecked();
    await waitFor(() => {
      expect(backend.db.tasks[0]?.done).toBe(true);
    });
    // Done, it's no longer overdue.
    expect((await column("Done")).queryByText("Overdue")).not.toBeInTheDocument();

    await user.click((await column("Done")).getByRole("checkbox", { name: SEEDED }));
    expect(
      await (await column("To do")).findByRole("checkbox", { name: SEEDED }),
    ).not.toBeChecked();
  });

  test("a refused tick goes back, and says why", async () => {
    server.use(
      mock.patch("/v1/organizations/{organization_id}/claims/{claim_id}/tasks/{task_id}", () =>
        problem(409, "claim_locked"),
      ),
    );
    const user = userEvent.setup();
    await open();

    await user.click((await column("To do")).getByRole("checkbox", { name: SEEDED }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      `"${SEEDED}" didn't change. The claim was closed or cancelled`,
    );
    expect(
      await (await column("To do")).findByRole("checkbox", { name: SEEDED }),
    ).not.toBeChecked();
  });
});

describe("adding and changing tasks", () => {
  test("a new task, with a due date and someone to do it", async () => {
    const user = userEvent.setup();
    await open();
    await column("To do");

    await user.click(screen.getByRole("button", { name: "Add a task" }));
    const form = within(await screen.findByRole("dialog", { name: "Add a task" }));
    await user.type(
      form.getByRole("textbox", { name: /^What needs doing/ }),
      "Pull the baseboards",
    );
    fireEvent.change(form.getByLabelText(/^Due/), { target: { value: "2099-01-15" } });
    await choose(user, /^Who does it/, "Riley Tech");
    await user.click(form.getByRole("button", { name: "Add task" }));

    const added = await (
      await column("To do")
    ).findByRole("checkbox", { name: "Pull the baseboards" });
    expect(added.closest("li")).toHaveTextContent("Due Jan 15, 2099");
    expect(backend.db.tasks.at(-1)).toMatchObject({
      title: "Pull the baseboards",
      due_on: "2099-01-15",
      assignee: people.riley,
    });
  });

  test("only people who can do field work are offered, and a title is needed", async () => {
    const user = userEvent.setup();
    await open();
    await column("To do");

    await user.click(screen.getByRole("button", { name: "Add a task" }));
    const form = within(await screen.findByRole("dialog"));
    await user.click(form.getByRole("combobox", { name: /^Who does it/ }));
    expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual([
      "Nobody yet",
      "Morgan Member",
      "Riley Tech",
    ]);
    await user.keyboard("{Escape}");
    await user.click(form.getByRole("button", { name: "Add task" }));

    expect(await form.findByText("Say what needs doing.")).toBeInTheDocument();
  });

  test("editing a task", async () => {
    const user = userEvent.setup();
    await open();

    await user.click((await column("To do")).getByRole("button", { name: `Change "${SEEDED}"` }));
    await user.click(await screen.findByRole("menuitem", { name: "Edit" }));
    await choose(user, /^Who does it/, "Nobody yet");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(async () => {
      expect((await column("To do")).getByRole("listitem")).toHaveTextContent("Nobody yet");
    });
    expect(backend.db.tasks[0]?.assignee).toBeNull();
  });

  test("its creator deletes a task, asking first", async () => {
    const user = userEvent.setup();
    await open();

    await user.click((await column("To do")).getByRole("button", { name: `Change "${SEEDED}"` }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    await user.click(
      within(await screen.findByRole("alertdialog", { name: `Delete "${SEEDED}"?` })).getByRole(
        "button",
        { name: "Delete" },
      ),
    );

    expect(await (await column("To do")).findByText(/^Nothing to do/)).toBeInTheDocument();
  });
});

describe("who can do what", () => {
  test("a technician who didn't add a task can tick and edit it, not delete it", async () => {
    const user = userEvent.setup();
    await open("riley@example.com");

    await user.click((await column("To do")).getByRole("button", { name: `Change "${SEEDED}"` }));

    expect((await screen.findAllByRole("menuitem")).map((m) => m.textContent)).toEqual(["Edit"]);
  });

  test("a closed claim's tasks can only be looked at", async () => {
    const claim = backend.db.claims.find((c) => c.claim.id === ids.claim);
    if (claim) claim.claim.status = "closed";
    await open();

    const toDo = await column("To do");
    expect(toDo.getByRole("checkbox", { name: SEEDED })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Add a task" })).not.toBeInTheDocument();
    expect(toDo.queryByRole("button")).not.toBeInTheDocument();
  });
});
